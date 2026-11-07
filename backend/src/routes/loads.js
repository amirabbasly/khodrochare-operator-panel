'use strict';

const express = require('express');
const { z } = require('zod');
const { getDb } = require('../db');
const {
  parse,
  text,
  optionalText,
  phone,
  dateStr,
  id: idSchema,
  statusEnum,
  followUpEnum,
  loadTypeEnum,
} = require('../utils/validation');
const {
  ApiError,
  asyncHandler,
  createWhere,
  buildUpdate,
  parsePagination,
  paginationMeta,
} = require('../utils/http');
const { publicLoad } = require('../utils/serialize');
const { authRequired, adminOnly } = require('../middleware/auth');
const { todayStr } = require('../utils/dates');
const { assertDayOpen } = require('../services/dayClosure');
const { toSearchTokens, rebuildLoadSearchText } = require('../services/searchIndex');
const { resolveLocation } = require('../utils/locations');
const { computeCommission, normalizeAmount } = require('../services/commissions');

const router = express.Router();

router.use(authRequired);

const LOAD_SELECT = `
  l.id, l.load_date, l.vehicle_name, l.customer_phone, l.car_problem, l.customer_name,
  l.rescuer_id, l.rescuer_name, l.address, l.description,
  l.zone_id, z.name AS zone_name, l.city_id, c.name AS city_name,
  l.status, l.cancel_reason, l.follow_up, l.created_by,
  u.username AS created_by_username,
  l.amount_received, l.load_type, l.garage_dispatched,
  l.commission_rate, l.commission_amount,
  l.is_paid, l.paid_at, l.paid_amount, l.paid_by,
  pu.username AS paid_by_username,
  l.created_at, l.updated_at,
  CASE WHEN dc.day IS NULL THEN FALSE ELSE TRUE END AS day_closed
`;

const LOAD_FROM = `
  FROM loads l
  LEFT JOIN zones z ON z.id = l.zone_id
  LEFT JOIN cities c ON c.id = l.city_id
  LEFT JOIN rescuers r ON r.id = l.rescuer_id
  LEFT JOIN users u ON u.id = l.created_by
  LEFT JOIN users pu ON pu.id = l.paid_by
  LEFT JOIN day_closures dc ON dc.day = l.load_date
`;

async function fetchLoad(db, id) {
  const row = await db.one(`SELECT ${LOAD_SELECT} ${LOAD_FROM} WHERE l.id = $1`, [id]);
  return row ? publicLoad(row) : null;
}

function buildFilters(query) {
  const where = createWhere();
  const date = query.date ? String(query.date) : null;
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw ApiError.badRequest('تاریخ انتخابی معتبر نیست.');
    where.add('l.load_date = ?::date', date);
  } else {
    if (from) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw ApiError.badRequest('تاریخ شروع معتبر نیست.');
      where.add('l.load_date >= ?::date', from);
    }
    if (to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw ApiError.badRequest('تاریخ پایان معتبر نیست.');
      where.add('l.load_date <= ?::date', to);
    }
  }

  if (query.status) where.add('l.status = ?', String(query.status));
  if (query.loadType) where.add('l.load_type = ?', String(query.loadType));
  if (query.paid === 'true') where.raw('l.is_paid = TRUE');
  if (query.paid === 'false') where.raw('l.is_paid = FALSE');
  if (query.followUp) where.add('l.follow_up = ?', String(query.followUp));
  if (query.zoneId) where.add('l.zone_id = ?', Number(query.zoneId));
  if (query.cityId) where.add('l.city_id = ?', Number(query.cityId));
  if (query.rescuerId) where.add('l.rescuer_id = ?', Number(query.rescuerId));
  if (query.createdBy) where.add('l.created_by = ?', Number(query.createdBy));
  if (query.onlyMine === 'true' || query.onlyMine === '1') where.add('l.created_by = ?', Number(query.userId));

  for (const token of toSearchTokens(query.q)) {
    where.add('l.search_text LIKE ?', `%${token}%`);
  }

  return where;
}

function buildDateParams(query, userId) {
  return {
    ...query,
    date: query.date,
    from: query.from,
    to: query.to,
    userId,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 200 });
    const where = buildFilters(buildDateParams(req.query, req.user.id));

    const total = Number(
      await db.scalar(`SELECT COUNT(*)::int AS count ${LOAD_FROM} ${where.sql}`, where.params)
    );

    const rows = await db.many(
      `SELECT ${LOAD_SELECT} ${LOAD_FROM} ${where.sql}
       ORDER BY l.load_date DESC, l.id DESC
       LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, limit, offset]
    );

    const summaryRow = await db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN l.status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
              SUM(CASE WHEN l.status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
              SUM(CASE WHEN l.status = 'pending' THEN 1 ELSE 0 END)::int AS pending,
              SUM(CASE WHEN l.follow_up = 'done' THEN 1 ELSE 0 END)::int AS follow_up_done,
              SUM(CASE WHEN l.follow_up = 'not_done' THEN 1 ELSE 0 END)::int AS follow_up_not_done
       ${LOAD_FROM} ${where.sql}`,
      where.params
    );

    const dayClosedRow = req.query.date
      ? await db.one('SELECT day FROM day_closures WHERE day = $1::date', [req.query.date])
      : null;

    res.json({
      items: rows.map(publicLoad),
      pagination: paginationMeta({ page, limit, total }),
      summary: {
        total: Number(summaryRow?.total || 0),
        confirmed: Number(summaryRow?.confirmed || 0),
        cancelled: Number(summaryRow?.cancelled || 0),
        pending: Number(summaryRow?.pending || 0),
        followUpDone: Number(summaryRow?.follow_up_done || 0),
        followUpNotDone: Number(summaryRow?.follow_up_not_done || 0),
      },
      dayClosed: Boolean(dayClosedRow),
    });
  })
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const where = buildFilters(buildDateParams(req.query, req.user.id));
    const rows = await db.many(
      `SELECT ${LOAD_SELECT} ${LOAD_FROM} ${where.sql} ORDER BY l.load_date DESC, l.id DESC LIMIT 5000`,
      where.params
    );

    const header = [
      'شناسه',
      'تاریخ',
      'شهر',
      'محدوده',
      'نام امدادخواه',
      'شماره تماس',
      'خودرو',
      'مشکل خودرو',
      'امدادگر',
      'آدرس',
      'توضیحات',
      'وضعیت',
      'دلیل کنسلی',
      'پیگیری',
      'نوع بار',
      'مبلغ دریافتی',
      'درصد سهم امدادگر',
      'سهم امدادگر',
      'پرداخت‌شده',
      'مبلغ پرداخت‌شده',
      'اعزام به تعمیرگاه',
      'ثبت‌کننده',
    ];

    const escapeCell = (value) => {
      const str = value == null ? '' : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines = [header.join(',')];
    for (const row of rows) {
      const load = publicLoad(row);
      lines.push(
        [
          load.id,
          load.loadDate,
          load.cityName,
          load.zoneName,
          load.customerName,
          load.customerPhone,
          load.vehicleName,
          load.carProblem,
          load.rescuerName,
          load.address,
          load.description,
          load.statusLabel,
          load.cancelReason,
          load.followUpLabel,
          load.loadTypeLabel,
          load.amountReceived,
          load.commissionRate,
          load.commissionAmount,
          load.isPaid ? 'بله' : 'خیر',
          load.paidAmount ?? '',
          load.loadType === 'garage_dispatch' ? (load.garageDispatched ? 'اعزام شد' : 'اعزام نشد') : '—',
          load.createdByUsername,
        ]
          .map(escapeCell)
          .join(',')
      );
    }

    const csv = `\uFEFF${lines.join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="loads-${todayStr()}.csv"`
    );
    res.send(csv);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const item = await fetchLoad(db, Number(req.params.id));
    if (!item) throw ApiError.notFound('بار مورد نظر پیدا نشد.');
    res.json({ item });
  })
);

const createSchema = z
  .object({
    loadDate: dateStr.optional(),
    vehicleName: text(120).min(1, 'نام خودرو را وارد کنید.'),
    customerPhone: phone,
    carProblem: text(200).min(1, 'مشکل خودرو را وارد کنید.'),
    customerName: text(120).min(1, 'نام امدادخواه را وارد کنید.'),
    rescuerId: idSchema.nullish(),
    rescuerName: optionalText(120),
    address: optionalText(500),
    description: optionalText(1000),
    cityId: idSchema.nullish(),
    zoneId: idSchema.nullish(),
    // شهر و محدوده به صورت متن آزف (تایپ اپراتور) هم پذیرفته می‌شود
    cityName: optionalText(80),
    zoneName: optionalText(80),
    status: statusEnum.optional().default('pending'),
    cancelReason: optionalText(200),
    followUp: followUpEnum.optional().default('not_done'),
    // ---------- مالی ----------
    amountReceived: z.coerce.number().int().min(0, 'مبلغ نمی‌تواند منفی باشد.').max(1e12).optional().default(0),
    loadType: loadTypeEnum.optional().default('transport'),
    garageDispatched: z.boolean().optional().default(false),
    isPaid: z.boolean().optional().default(false),
  })
  .refine((data) => data.rescuerId || data.rescuerName, {
    message: 'نام امدادگر یا انتخاب امدادگر از فهرست الزامی است.',
    path: ['rescuerName'],
  })
  .refine((data) => data.status !== 'cancelled' || data.cancelReason, {
    message: 'برای ثبت بار کنسل‌شده، دلیل کنسلی را وارد کنید.',
    path: ['cancelReason'],
  });

async function resolveLoadRelations(db, { cityId, zoneId, cityName, zoneName, rescuerId, rescuerName }) {
  let resolvedRescuerName = rescuerName ?? null;

  const location = await resolveLocation(db, { cityId, zoneId, cityName, zoneName });
  const resolvedCityId = location.cityId;
  const resolvedZoneId = location.zoneId;

  if (rescuerId) {
    const rescuer = await db.one(
      'SELECT id, first_name, last_name, zone_id, city_id FROM rescuers WHERE id = $1',
      [rescuerId]
    );
    if (!rescuer) {
      throw ApiError.badRequest('امدادگر انتخاب‌شده معتبر نیست.', [
        { field: 'rescuerId', message: 'امدادگر یافت نشد.' },
      ]);
    }
    resolvedRescuerName = `${rescuer.first_name} ${rescuer.last_name}`.trim();
  }

  return { cityId: resolvedCityId, zoneId: resolvedZoneId, rescuerName: resolvedRescuerName };
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(createSchema, req.body);
    const db = await getDb();
    const loadDate = data.loadDate || todayStr();

    await assertDayOpen(db, loadDate);
    const relations = await resolveLoadRelations(db, data);

    const amountReceived = normalizeAmount(data.amountReceived);
    const commission = computeCommission(amountReceived, data.loadType);

    const created = await db.one(
      `INSERT INTO loads
        (load_date, vehicle_name, customer_phone, car_problem, customer_name,
         rescuer_id, rescuer_name, address, description, zone_id, city_id,
         status, cancel_reason, follow_up, created_by,
         amount_received, load_type, garage_dispatched, commission_rate, commission_amount,
         is_paid, paid_at, paid_by, paid_amount)
       VALUES ($1::date, $2::text, $3::text, $4::text, $5::text, $6::int, $7::text, $8::text,
               $9::text, $10::int, $11::int, $12::text, $13::text, $14::text, $15::int,
               $16::bigint, $17::text, $18::boolean, $19::numeric, $20::bigint,
               $21::boolean,
               CASE WHEN $21::boolean THEN NOW() ELSE NULL END,
               CASE WHEN $21::boolean THEN $22::int ELSE NULL END,
               CASE WHEN $21::boolean THEN $20::bigint ELSE NULL END)
       RETURNING id`,
      [
        loadDate,
        data.vehicleName,
        data.customerPhone,
        data.carProblem,
        data.customerName,
        data.rescuerId ?? null,
        relations.rescuerName,
        data.address,
        data.description,
        relations.zoneId,
        relations.cityId,
        data.status,
        data.status === 'cancelled' ? data.cancelReason : null,
        data.followUp,
        req.user.id,
        amountReceived,
        data.loadType,
        Boolean(data.garageDispatched),
        commission.rate,
        commission.amount,
        Boolean(data.isPaid),
        req.user.id,
      ]
    );

    await rebuildLoadSearchText(db, created.id);
    const item = await fetchLoad(db, created.id);
    res.status(201).json({ item, message: 'بار جدید با موفقیت ثبت شد.' });
  })
);

const updateSchema = z.object({
  loadDate: dateStr.optional(),
  vehicleName: text(120).min(1).optional(),
  customerPhone: phone.optional(),
  carProblem: text(200).min(1).optional(),
  customerName: text(120).min(1).optional(),
  rescuerId: idSchema.nullish(),
  rescuerName: optionalText(120),
  address: optionalText(500),
  description: optionalText(1000),
  cityId: idSchema.nullish(),
  zoneId: idSchema.nullish(),
  cityName: optionalText(80),
  zoneName: optionalText(80),
  status: statusEnum.optional(),
  cancelReason: optionalText(200),
  followUp: followUpEnum.optional(),
  amountReceived: z.coerce.number().int().min(0, 'مبلغ نمی‌تواند منفی باشد.').max(1e12).optional(),
  loadType: loadTypeEnum.optional(),
  garageDispatched: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const loadId = Number(req.params.id);
    const data = parse(updateSchema, req.body);
    const db = await getDb();

    const current = await db.one('SELECT * FROM loads WHERE id = $1', [loadId]);
    if (!current) throw ApiError.notFound('بار مورد نظر پیدا نشد.');

    await assertDayOpen(db, current.load_date);
    if (data.loadDate && data.loadDate !== current.load_date) {
      await assertDayOpen(db, data.loadDate);
    }

    const nextStatus = data.status ?? current.status;
    const nextCancelReason =
      'cancelReason' in req.body ? data.cancelReason : current.cancel_reason;

    if (nextStatus === 'cancelled' && !nextCancelReason) {
      throw ApiError.badRequest('برای کنسل کردن بار، دلیل کنسلی را وارد کنید.', [
        { field: 'cancelReason', message: 'دلیل کنسلی الزامی است.' },
      ]);
    }

    let location = {};
    if (['cityId', 'zoneId', 'cityName', 'zoneName'].some((field) => field in req.body)) {
      const relations = await resolveLoadRelations(db, {
        cityId: data.cityId ?? null,
        zoneId: data.zoneId ?? null,
        cityName: data.cityName ?? null,
        zoneName: data.zoneName ?? null,
      });
      location = {
        city_id: data.cityName || 'cityId' in req.body ? relations.cityId : current.city_id || null,
        zone_id: relations.zoneId ?? current.zone_id ?? null,
      };
    }

    let rescuerFields = {};
    if ('rescuerId' in req.body) {
      if (data.rescuerId) {
        const relations = await resolveLoadRelations(db, {
          rescuerId: data.rescuerId,
          rescuerName: data.rescuerName ?? null,
        });
        rescuerFields = { rescuer_id: data.rescuerId, rescuer_name: relations.rescuerName };
      } else {
        rescuerFields = {
          rescuer_id: null,
          rescuer_name: data.rescuerName ?? null,
        };
      }
    } else if ('rescuerName' in req.body) {
      rescuerFields = { rescuer_name: data.rescuerName };
    }

    // ---------- مالی: با تغییر مبلغ یا نوع بار، سهم امدادگر بازمحاسبه می‌شود ----------
    const touchesMoney = 'amountReceived' in req.body || 'loadType' in req.body;
    let money = {};
    if (touchesMoney) {
      const amountReceived = normalizeAmount(
        'amountReceived' in req.body ? data.amountReceived : current.amount_received
      );
      const loadType = data.loadType ?? current.load_type;
      const commission = computeCommission(amountReceived, loadType);
      const stillPaid = 'isPaid' in req.body ? Boolean(data.isPaid) : Boolean(current.is_paid);
      money = {
        amount_received: amountReceived,
        load_type: loadType,
        commission_rate: commission.rate,
        commission_amount: commission.amount,
        paid_amount: stillPaid ? commission.amount : null,
      };
    }

    let payment = {};
    if ('isPaid' in req.body) {
      const paid = Boolean(data.isPaid);
      const settled = Number(
        money.commission_amount ?? (touchesMoney ? 0 : current.commission_amount) ?? 0
      );
      payment = {
        is_paid: paid,
        paid_at: paid ? new Date() : null,
        paid_by: paid ? req.user.id : null,
        paid_amount: paid ? settled : null,
      };
    }

    const changes = buildUpdate({
      load_date: data.loadDate,
      vehicle_name: data.vehicleName,
      customer_phone: data.customerPhone,
      car_problem: data.carProblem,
      customer_name: data.customerName,
      address: 'address' in req.body ? data.address : undefined,
      description: 'description' in req.body ? data.description : undefined,
      status: data.status,
      cancel_reason: nextStatus === 'cancelled' ? nextCancelReason : null,
      follow_up: data.followUp,
      garage_dispatched:
        'garageDispatched' in req.body ? Boolean(data.garageDispatched) : undefined,
      ...payment,
      ...money,
      ...location,
      ...rescuerFields,
    });

    if (changes.isEmpty) throw ApiError.badRequest('هیچ تغییری برای به‌روزرسانی ارسال نشده است.');

    await db.query(
      `UPDATE loads SET ${changes.sql}, updated_at = NOW() WHERE id = $${changes.nextIndex}`,
      [...changes.params, loadId]
    );

    await rebuildLoadSearchText(db, loadId);
    const item = await fetchLoad(db, loadId);
    res.json({ item, message: 'بار به‌روزرسانی شد.' });
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const loadId = Number(req.params.id);
    const data = parse(
      z.object({ status: statusEnum, cancelReason: optionalText(200) }),
      req.body
    );
    const db = await getDb();

    const current = await db.one('SELECT id, load_date, status FROM loads WHERE id = $1', [loadId]);
    if (!current) throw ApiError.notFound('بار مورد نظر پیدا نشد.');

    await assertDayOpen(db, current.load_date);

    if (data.status === 'cancelled' && !data.cancelReason) {
      throw ApiError.badRequest('برای کنسل کردن بار، دلیل کنسلی را وارد کنید.', [
        { field: 'cancelReason', message: 'دلیل کنسلی الزامی است.' },
      ]);
    }

    await db.query(
      `UPDATE loads SET status = $1, cancel_reason = $2, updated_at = NOW() WHERE id = $3`,
      [data.status, data.status === 'cancelled' ? data.cancelReason : null, loadId]
    );

    const item = await fetchLoad(db, loadId);
    res.json({
      item,
      message:
        data.status === 'confirmed'
          ? 'بار تایید شد.'
          : data.status === 'cancelled'
            ? 'بار کنسل شد.'
            : 'وضعیت بار به «در انتظار» تغییر کرد.',
    });
  })
);

/**
 * ثبت «پرداخت انجام شد / انجام نشد» برای سهم امدادگر.
 * هم مدیر و هم اپراتور می‌توانند ثبت کنند؛ ثبت‌کننده ذخیره می‌شود.
 */
router.patch(
  '/:id/payment',
  asyncHandler(async (req, res) => {
    const loadId = Number(req.params.id);
    const data = parse(
      z.object({
        isPaid: z.boolean({ required_error: 'وضعیت پرداخت را مشخص کنید.' }),
        paidAmount: z.coerce.number().int().min(0).max(1e12).optional(),
      }),
      req.body
    );

    const db = await getDb();
    const current = await db.one(
      'SELECT id, commission_amount, is_paid FROM loads WHERE id = $1',
      [loadId]
    );
    if (!current) throw ApiError.notFound('بار مورد نظر پیدا نشد.');

    const settled = data.paidAmount ?? Number(current.commission_amount || 0);

    await db.query(
      `UPDATE loads
          SET is_paid = $2::boolean,
              paid_at = CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
              paid_by = CASE WHEN $2::boolean THEN $3::int ELSE NULL END,
              paid_amount = CASE WHEN $2::boolean THEN $4::bigint ELSE NULL END,
              updated_at = NOW()
        WHERE id = $1`,
      [loadId, data.isPaid, req.user.id, settled]
    );

    const item = await fetchLoad(db, loadId);
    res.json({
      item,
      message: data.isPaid
        ? `پرداخت به مبلغ ${settled} ثبت شد.`
        : 'این بار به‌عنوان «پرداخت‌نشده» علامت‌گذاری شد.',
    });
  })
);

router.patch(
  '/:id/follow-up',
  asyncHandler(async (req, res) => {
    const loadId = Number(req.params.id);
    const data = parse(z.object({ followUp: followUpEnum }), req.body);
    const db = await getDb();

    const current = await db.one('SELECT id, load_date FROM loads WHERE id = $1', [loadId]);
    if (!current) throw ApiError.notFound('بار مورد نظر پیدا نشد.');

    await assertDayOpen(db, current.load_date);

    await db.query('UPDATE loads SET follow_up = $1, updated_at = NOW() WHERE id = $2', [
      data.followUp,
      loadId,
    ]);

    const item = await fetchLoad(db, loadId);
    res.json({
      item,
      message: data.followUp === 'done' ? 'پیگیری انجام شد.' : 'پیگیری انجام‌نشده ثبت شد.',
    });
  })
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const loadId = Number(req.params.id);
    const db = await getDb();

    const current = await db.one('SELECT id, load_date FROM loads WHERE id = $1', [loadId]);
    if (!current) throw ApiError.notFound('بار مورد نظر پیدا نشد.');

    await assertDayOpen(db, current.load_date);
    await db.query('DELETE FROM loads WHERE id = $1', [loadId]);

    res.json({ message: 'بار حذف شد.' });
  })
);

module.exports = router;
