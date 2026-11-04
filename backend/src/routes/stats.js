'use strict';

const express = require('express');
const { getDb } = require('../db');
const { asyncHandler, ApiError } = require('../utils/http');
const { authRequired, adminOnly } = require('../middleware/auth');
const { isDateStr, clampRange, todayStr } = require('../utils/dates');
const { buildOverview, buildDetailed, operatorPerformance } = require('../services/stats');

const router = express.Router();

router.use(authRequired);

function resolveRange(query) {
  const from = query.from ? String(query.from) : null;
  const to = query.to ? String(query.to) : null;

  if ((from && !isDateStr(from)) || (to && !isDateStr(to))) {
    throw ApiError.badRequest('بازه‌ی تاریخ معتبر نیست. قالب صحیح: YYYY-MM-DD');
  }

  return clampRange(from, to);
}

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const range = resolveRange(req.query);
    const data = await buildOverview(db, range);
    res.json(data);
  })
);

router.get(
  '/detailed',
  adminOnly,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const range = resolveRange(req.query);
    const data = await buildDetailed(db, range);
    res.json(data);
  })
);

router.get(
  '/operators',
  adminOnly,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const range = resolveRange(req.query);
    const items = await operatorPerformance(db, range.from, range.to);
    res.json({ range, items });
  })
);

router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const date = req.query.date && isDateStr(String(req.query.date)) ? String(req.query.date) : todayStr();
    const row = await db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
       FROM loads WHERE load_date = $1::date`,
      [date]
    );

    const closure = await db.one('SELECT day FROM day_closures WHERE day = $1::date', [date]);

    res.json({
      date,
      total: Number(row?.total || 0),
      confirmed: Number(row?.confirmed || 0),
      cancelled: Number(row?.cancelled || 0),
      pending: Number(row?.pending || 0),
      dayClosed: Boolean(closure),
    });
  })
);

module.exports = router;
