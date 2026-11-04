'use strict';

const express = require('express');
const { getDb } = require('../db');
const { asyncHandler, ApiError, parsePagination, paginationMeta } = require('../utils/http');
const { authRequired, adminOnly } = require('../middleware/auth');
const security = require('../services/security');

const router = express.Router();

router.use(authRequired, adminOnly);

const REASON_LABELS = {
  decoy_credentials: 'استفاده از حساب تله (ادمین فیک)',
  brute_force: 'تلاش ناموفق مکرر (بروت‌فورس)',
  manual: 'مسدودسازی دستی توسط مدیر',
};

router.get(
  '/bans',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 200 });
    const onlyActive = req.query.active !== 'false';

    const whereSql = onlyActive ? 'WHERE is_active = TRUE' : '';
    const total = Number(
      await db.scalar(`SELECT COUNT(*)::int AS count FROM banned_ips ${whereSql}`)
    );

    const rows = await db.many(
      `SELECT ip, reason, username, user_agent, attempts, is_active, first_seen_at, last_seen_at
         FROM banned_ips ${whereSql}
        ORDER BY is_active DESC, last_seen_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const summary = await db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active,
              SUM(CASE WHEN reason = 'decoy_credentials' THEN 1 ELSE 0 END)::int AS decoy,
              SUM(CASE WHEN reason = 'brute_force' THEN 1 ELSE 0 END)::int AS brute_force,
              COALESCE(SUM(attempts), 0) AS attempts
         FROM banned_ips`
    );

    res.json({
      items: rows.map((row) => ({
        ip: row.ip,
        reason: row.reason,
        reasonLabel: REASON_LABELS[row.reason] || row.reason,
        username: row.username,
        userAgent: row.user_agent,
        attempts: Number(row.attempts || 0),
        isActive: Boolean(row.is_active),
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
      })),
      summary: {
        total: Number(summary?.total || 0),
        active: Number(summary?.active || 0),
        decoy: Number(summary?.decoy || 0),
        bruteForce: Number(summary?.brute_force || 0),
        attempts: Number(summary?.attempts || 0),
      },
      pagination: paginationMeta({ page, limit, total }),
      reasons: Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label })),
    });
  })
);

router.delete(
  '/bans/:ip',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const ip = decodeURIComponent(String(req.params.ip || '')).trim();
    if (!ip) throw ApiError.badRequest('آدرس IP معتبر نیست.');

    const existing = await db.one('SELECT ip FROM banned_ips WHERE ip = $1', [ip]);
    if (!existing) throw ApiError.notFound('این IP در فهرست مسدودها نیست.');

    await security.unbanIp(db, ip);
    res.json({ message: 'مسدودی این IP برداشته شد.' });
  })
);

/** مسدودسازی دستی یک IP (برای مواردی که مدیر خودش تشخیص می‌دهد) */
router.post(
  '/bans',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const ip = String(req.body?.ip || '').trim();
    if (!/^[0-9a-fA-F.:]{3,64}$/.test(ip)) throw ApiError.badRequest('آدرس IP معتبر نیست.');

    await security.banIp(db, {
      ip,
      reason: 'manual',
      username: req.user.username,
      userAgent: req.headers['user-agent'] || null,
    });

    res.status(201).json({ message: 'IP مسدود شد.' });
  })
);

module.exports = router;
