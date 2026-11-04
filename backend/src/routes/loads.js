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

const router = express.Router();

router.use(authRequired);

const LOAD_SELECT = `
  l.id, l.load_date, l.vehicle_name, l.customer_phone, l.car_problem, l.customer_name,
  l.rescuer_id, l.rescuer_name, l.address, l.description,
  l.zone_id, z.name AS zone_name, l.city_id, c.name AS city_name,
  l.status, l.cancel_reason, l.follow_up, l.created_by,
  u.username AS created_by_username,
  l.created_at, l.updated_at,
  CASE WHEN dc.day IS NULL THEN FALSE ELSE TRUE END AS day_closed
`;

const LOAD_FROM = `
  FROM loads l
  LEFT JOIN zones z ON z.id = l.zone_id
  LEFT JOIN cities c ON c.id = l.city_id
  LEFT JOIN rescuers r ON r.id = l.rescuer_id
  LEFT JOIN users u ON u.id = l.created_by
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
              SUM(CASE WHEN l.follow_up = 'done' THEN 1 ELSE 0 END)::int AS follow_up_done
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
    status: statusEnum.optional().default('pending'),
    cancelReason: optionalText(200),
    followUp: followUpEnum.optional().default('not_done'),
  })
  .refine((data) => data.rescuerId || data.rescuerName, {
    message: 'نام امدادگر یا انتخاب امدادگر از فهرست الزامی است.',
    path: ['rescuerName'],
  })
  .refine((data) => data.status !== 'cancelled' || data.cancelReason, {
    message: 'برای ثبت بار کنسل‌شده، دلیل کنسلی را وارد کنید.',
    path: ['cancelReason'],
  });

async function resolveLoadRelations(db, { cityId, zoneId, rescuerId, rescuerName }) {
  let resolvedCityId = cityId ?? null;
  let resolvedZoneId = zoneId ?? null;
  let resolvedRescuerName = rescuerName ?? null;

  if (cityId) {
    const city = await db.one('SELECT id, zone_id,name FROM cities WHERE id = $1', [cityId]);
    if (!city) {
      throw ApiError.badRequest('شهر انتخاب‌شده معتبر نیست.', [{ field: 'cityId', message: 'شهر یافت نشد.' }]);
    }
    if (!zoneId) resolvedZoneId = city.zone_id;
  }

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

    const created = await db.one(
      `INSERT INTO loads
        (load_date, vehicle_name, customer_phone, car_problem, customer_name,
         rescuer_id, rescuer_name, address, description, zone_id, city_id,
         status, cancel_reason, follow_up, created_by)
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
  status: statusEnum.optional(),
  cancelReason: optionalText(200),
  followUp: followUpEnum.optional(),
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
    if ('cityId' in req.body || 'zoneId' in req.body) {
      const relations = await resolveLoadRelations(db, {
        cityId: data.cityId ?? null,
        zoneId: data.zoneId ?? null,
      });
      location = { city_id: relations.cityId, zone_id: relations.zoneId };
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
