'use strict';

const express = require('express');
const { z } = require('zod');
const { getDb } = require('../db');
const {
  parse,
  text,
  optionalText,
  optionalPhone,
  id: idSchema,
  workTypeEnum,
} = require('../utils/validation');
const {
  ApiError,
  asyncHandler,
  createWhere,
  buildUpdate,
  parsePagination,
  paginationMeta,
} = require('../utils/http');
const { publicRescuer } = require('../utils/serialize');
const { authRequired, adminOnly } = require('../middleware/auth');
const { toSearchTokens, rebuildRescuerSearchText } = require('../services/searchIndex');
const { resolveLocation } = require('../utils/locations');

const router = express.Router();

router.use(authRequired);

const RESCUER_SELECT = `
  r.id, r.first_name, r.last_name, r.phone, r.vehicle, r.plate,
  r.zone_id, r.city_id, r.work_type, r.is_active, r.notes, r.created_at, r.updated_at,
  z.name AS zone_name,
  c.name AS city_name,
  COALESCE(s.total_loads, 0)     AS total_loads,
  COALESCE(s.confirmed_loads, 0) AS confirmed_loads,
  COALESCE(s.cancelled_loads, 0) AS cancelled_loads,
  COALESCE(s.billed_amount, 0)   AS billed_amount,
  COALESCE(s.paid_amount, 0)     AS paid_amount,
  COALESCE(s.earned_amount, 0)   AS earned_amount,
  COALESCE(s.paid_loads, 0)      AS paid_loads,
  COALESCE(s.unpaid_loads, 0)    AS unpaid_loads
`;

const RESCUER_FROM = `
  FROM rescuers r
  LEFT JOIN zones z ON z.id = r.zone_id
  LEFT JOIN cities c ON c.id = r.city_id
  LEFT JOIN (
    SELECT rescuer_id,
           COUNT(*)::int AS total_loads,
           SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed_loads,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled_loads,
           SUM(CASE WHEN status <> 'cancelled' THEN commission_amount ELSE 0 END) AS billed_amount,
           SUM(CASE WHEN status <> 'cancelled' AND is_paid THEN commission_amount ELSE 0 END) AS paid_amount,
           SUM(CASE WHEN status <> 'cancelled' AND is_paid THEN 1 ELSE 0 END)::int AS paid_loads,
           SUM(CASE WHEN status <> 'cancelled' AND is_paid = FALSE THEN 1 ELSE 0 END)::int AS unpaid_loads,
           SUM(CASE WHEN status <> 'cancelled' THEN amount_received - commission_amount ELSE 0 END) AS earned_amount
    FROM loads
    GROUP BY rescuer_id
  ) s ON s.rescuer_id = r.id
`;

const baseSchema = z.object({
  firstName: text(80).min(1, 'نام امدادگر را وارد کنید.'),
  lastName: text(80).min(1, 'نام خانوادگی امدادگر را وارد کنید.'),
  phone: optionalPhone,
  vehicle: text(80).min(1, 'خودروی امدادگر را وارد کنید.'),
  plate: text(30).min(1, 'پلاک خودرو را وارد کنید.'),
  zoneId: idSchema.nullish(),
  cityId: idSchema.nullish(),
  // اپراتور شهر و محدوده را خودش تایپ می‌کند (ورودی متنی، نه انتخاب از فهرست)
  zoneName: optionalText(80),
  cityName: optionalText(80),
  workType: workTypeEnum,
  isActive: z.boolean().optional(),
  notes: optionalText(500),
});

const createSchema = baseSchema;

const updateSchema = baseSchema.partial();

const LOCATION_FIELDS = ['zoneId', 'cityId', 'zoneName', 'cityName'];

function hasLocationInput(body) {
  return LOCATION_FIELDS.some((field) => field in body);
}

function buildSearch(where, q) {
  for (const token of toSearchTokens(q)) {
    where.add('r.search_text LIKE ?', `%${token}%`);
  }
}

const SORTABLE = {
  total: 'COALESCE(s.total_loads, 0)',
  confirmed: 'COALESCE(s.confirmed_loads, 0)',
  cancelled: 'COALESCE(s.cancelled_loads, 0)',
  name: 'r.last_name',
  newest: 'r.created_at',
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
    const where = createWhere();

    if (req.query.zoneId) where.add('r.zone_id = ?', Number(req.query.zoneId));
    if (req.query.cityId) where.add('r.city_id = ?', Number(req.query.cityId));
    if (req.query.workType) where.add('r.work_type = ?', String(req.query.workType));
    if (req.query.isActive === 'true') where.raw('r.is_active = TRUE');
    if (req.query.isActive === 'false') where.raw('r.is_active = FALSE');
    buildSearch(where, String(req.query.q || '').trim());

    const orderBy = SORTABLE[String(req.query.sort || '')] || SORTABLE.name;
    const direction = String(req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const total = Number(
      await db.scalar(
        `SELECT COUNT(*)::int AS count FROM rescuers r
         LEFT JOIN zones z ON z.id = r.zone_id
         LEFT JOIN cities c ON c.id = r.city_id
         ${where.sql}`,
        where.params
      )
    );

    const rows = await db.many(
      `SELECT ${RESCUER_SELECT} ${RESCUER_FROM} ${where.sql}
       ORDER BY r.is_active DESC, ${orderBy} ${direction}
       LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, limit, offset]
    );

    const summary = await db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN r.is_active THEN 1 ELSE 0 END)::int AS active,
              SUM(CASE WHEN r.work_type = 'garage' THEN 1 ELSE 0 END)::int AS garages
       FROM rescuers r
       LEFT JOIN zones z ON z.id = r.zone_id
       LEFT JOIN cities c ON c.id = r.city_id
       ${where.sql}`,
      where.params
    );

    res.json({
      items: rows.map(publicRescuer),
      pagination: paginationMeta({ page, limit, total }),
      summary: {
        total: Number(summary?.total || 0),
        active: Number(summary?.active || 0),
        garages: Number(summary?.garages || 0),
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const row = await db.one(
      `SELECT ${RESCUER_SELECT} ${RESCUER_FROM} WHERE r.id = $1`,
      [Number(req.params.id)]
    );
    if (!row) throw ApiError.notFound('امدادگر مورد نظر پیدا نشد.');

    const recentLoads = await db.many(
      `SELECT l.id, l.load_date, l.customer_name, l.vehicle_name, l.car_problem, l.status,
              l.cancel_reason, l.follow_up, l.amount_received, l.load_type,
              l.commission_rate, l.commission_amount, l.is_paid, c.name AS city_name
       FROM loads l
       LEFT JOIN cities c ON c.id = l.city_id
       WHERE l.rescuer_id = $1
       ORDER BY l.load_date DESC, l.id DESC
       LIMIT 10`,
      [row.id]
    );

    res.json({
      item: publicRescuer(row),
      recentLoads: recentLoads.map((load) => ({
        id: load.id,
        loadDate: load.load_date,
        customerName: load.customer_name,
        vehicleName: load.vehicle_name,
        carProblem: load.car_problem,
        cityName: load.city_name,
        status: load.status,
        cancelReason: load.cancel_reason,
        followUp: load.follow_up,
        amountReceived: Number(load.amount_received || 0),
        loadType: load.load_type,
        commissionRate: Number(load.commission_rate || 0),
        commissionAmount: Number(load.commission_amount || 0),
        isPaid: Boolean(load.is_paid),
      })),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(createSchema, req.body);
    const db = await getDb();
    const location = await resolveLocation(db, data);

    const created = await db.one(
      `INSERT INTO rescuers
        (first_name, last_name, phone, vehicle, plate, zone_id, city_id, work_type, is_active, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        data.firstName,
        data.lastName,
        data.phone,
        data.vehicle,
        data.plate,
        location.zoneId,
        location.cityId,
        data.workType,
        data.isActive !== false,
        data.notes,
      ]
    );

    await rebuildRescuerSearchText(db, created.id);
    const row = await db.one(`SELECT ${RESCUER_SELECT} ${RESCUER_FROM} WHERE r.id = $1`, [created.id]);
    res.status(201).json({ item: publicRescuer(row), message: 'امدادگر جدید ثبت شد.' });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const rescuerId = Number(req.params.id);
    const data = parse(updateSchema, req.body);
    const db = await getDb();

    const current = await db.one('SELECT * FROM rescuers WHERE id = $1', [rescuerId]);
    if (!current) throw ApiError.notFound('امدادگر مورد نظر پیدا نشد.');

    let location = {};
    if (hasLocationInput(req.body)) {
      const wantsCity = Boolean(data.cityId) || Boolean(data.cityName);
      const resolved = await resolveLocation(db, {
        cityId: data.cityId ?? null,
        cityName: data.cityName ?? null,
        zoneName: data.zoneName ?? null,
        zoneId: data.zoneId ?? null,
      });
      location = {
        city_id: wantsCity ? resolved.cityId : current.city_id || null,
        zone_id: resolved.zoneId ?? (wantsCity ? null : current.zone_id || null),
      };
    }

    const changes = buildUpdate({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: 'phone' in req.body ? data.phone : undefined,
      vehicle: data.vehicle,
      plate: data.plate,
      work_type: data.workType,
      is_active: typeof data.isActive === 'boolean' ? data.isActive : undefined,
      notes: 'notes' in req.body ? data.notes : undefined,
      ...location,
    });

    if (changes.isEmpty) throw ApiError.badRequest('هیچ تغییری برای به‌روزرسانی ارسال نشده است.');

    await db.query(
      `UPDATE rescuers SET ${changes.sql}, updated_at = NOW() WHERE id = $${changes.nextIndex}`,
      [...changes.params, rescuerId]
    );

    await rebuildRescuerSearchText(db, rescuerId);
    const row = await db.one(`SELECT ${RESCUER_SELECT} ${RESCUER_FROM} WHERE r.id = $1`, [rescuerId]);
    res.json({ item: publicRescuer(row), message: 'اطلاعات امدادگر به‌روزرسانی شد.' });
  })
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const rescuerId = Number(req.params.id);
    const db = await getDb();

    const rescuer = await db.one('SELECT id FROM rescuers WHERE id = $1', [rescuerId]);
    if (!rescuer) throw ApiError.notFound('امدادگر مورد نظر پیدا نشد.');

    const loadCount = Number(
      await db.scalar('SELECT COUNT(*)::int AS count FROM loads WHERE rescuer_id = $1', [rescuerId])
    );
    if (loadCount > 0) {
      throw ApiError.conflict(
        'این امدادگر در بارهای ثبت‌شده استفاده شده است و قابل حذف نیست؛ می‌توانید او را غیرفعال کنید.'
      );
    }

    await db.query('DELETE FROM rescuers WHERE id = $1', [rescuerId]);
    res.json({ message: 'امدادگر حذف شد.' });
  })
);

module.exports = router;
