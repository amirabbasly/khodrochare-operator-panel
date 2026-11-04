'use strict';

const express = require('express');
const { z } = require('zod');
const { getDb } = require('../db');
const { parse, optionalText } = require('../utils/validation');
const { ApiError, asyncHandler } = require('../utils/http');
const { authRequired } = require('../middleware/auth');
const { isDateStr, todayStr, addDays } = require('../utils/dates');
const { getDayClosure } = require('../services/dayClosure');

const router = express.Router();

router.use(authRequired);

function assertDateParam(value) {
  if (!isDateStr(value)) {
    throw ApiError.badRequest('تاریخ معتبر نیست. قالب صحیح: YYYY-MM-DD');
  }
  return value;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const to = req.query.to && isDateStr(String(req.query.to)) ? String(req.query.to) : todayStr();
    const from =
      req.query.from && isDateStr(String(req.query.from))
        ? String(req.query.from)
        : addDays(to, -60);

    const rows = await db.many(
      `SELECT dc.day, dc.closed_at, dc.note,
              u.first_name || ' ' || u.last_name AS closed_by_name
       FROM day_closures dc
       LEFT JOIN users u ON u.id = dc.closed_by
       WHERE dc.day BETWEEN $1::date AND $2::date`,
      [from, to]
    );

    const items = rows
      .map((row) => ({
        date: row.day,
        closedAt: row.closed_at,
        closedByName: row.closed_by_name,
        note: row.note,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    res.json({ items });
  })
);

router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const date = assertDateParam(req.params.date);
    const db = await getDb();

    const closure = await getDayClosure(db, date);
    const summary = await db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
       FROM loads WHERE load_date = $1::date`,
      [date]
    );

    res.json({
      date,
      isClosed: Boolean(closure),
      closedAt: closure?.closed_at || null,
      closedByName: closure?.closed_by_name || null,
      note: closure?.note || null,
      summary: {
        total: Number(summary?.total || 0),
        confirmed: Number(summary?.confirmed || 0),
        cancelled: Number(summary?.cancelled || 0),
        pending: Number(summary?.pending || 0),
      },
    });
  })
);

router.post(
  '/:date/close',
  asyncHandler(async (req, res) => {
    const date = assertDateParam(req.params.date);
    const data = parse(z.object({ note: optionalText(200) }), req.body || {});
    const db = await getDb();

    if (date > todayStr()) {
      throw ApiError.badRequest('روزهای آینده قابل بستن نیستند.');
    }

    const existing = await db.one('SELECT day FROM day_closures WHERE day = $1::date', [date]);
    if (existing) throw ApiError.conflict('این روز قبلاً بسته شده است.');

    await db.query('INSERT INTO day_closures (day, closed_by, note) VALUES ($1::date, $2, $3)', [
      date,
      req.user.id,
      data.note || null,
    ]);

    const summary = await db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
       FROM loads WHERE load_date = $1::date`,
      [date]
    );

    res.json({
      date,
      isClosed: true,
      message: `روز ${date} بسته شد. (${Number(summary?.total || 0)} بار ثبت‌شده)`,
      summary: {
        total: Number(summary?.total || 0),
        pending: Number(summary?.pending || 0),
      },
    });
  })
);

router.post(
  '/:date/reopen',
  asyncHandler(async (req, res) => {
    const date = assertDateParam(req.params.date);
    const db = await getDb();

    const existing = await db.one('SELECT day FROM day_closures WHERE day = $1::date', [date]);
    if (!existing) throw ApiError.notFound('این روز بسته نشده است.');

    await db.query('DELETE FROM day_closures WHERE day = $1::date', [date]);
    res.json({ date, isClosed: false, message: `روز ${date} برای ویرایش باز شد.` });
  })
);

module.exports = router;
