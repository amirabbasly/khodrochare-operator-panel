'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');
const { ApiError, asyncHandler } = require('../utils/http');

const USER_COLUMNS =
  'id, first_name, last_name, username, phone, national_id, role, is_active, last_login_at, created_at, updated_at';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (req.headers['x-access-token']) return String(req.headers['x-access-token']);
  return null;
}

const authRequired = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError'
        ? 'نشست شما منقضی شده است؛ دوباره وارد شوید.'
        : 'توکن احراز هویت نامعتبر است.'
    );
  }

  const db = await getDb();
  const row = await db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [payload.sub]);

  if (!row) throw ApiError.unauthorized('حساب کاربری یافت نشد.');
  if (!row.is_active) throw ApiError.forbidden('حساب کاربری شما غیرفعال شده است.');

  req.user = row;
  req.userId = row.id;
  req.userRole = row.role;
  next();
});

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('این بخش فقط برای مدیر سیستم قابل دسترسی است.'));
    }
    return next();
  };
}

const adminOnly = requireRole('admin');

/** محدودکننده‌ی ساده‌ی تلاش ورود (در حافظه) */
function createLoginRateLimiter() {
  const attempts = new Map();
  const { windowMs, max } = config.loginRateLimit;

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(key);
    }
  }, Math.max(windowMs, 60000));
  if (cleanup.unref) cleanup.unref();

  return function loginRateLimiter(req, _res, next) {
    if (config.isTest) return next();

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${String(req.body?.username || '').toLowerCase()}`;
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const minutes = Math.ceil((entry.resetAt - now) / 60000);
      return next(
        ApiError.conflict(`تلاش‌های ناموفق زیاد بوده است؛ ${minutes} دقیقه‌ی دیگر دوباره تلاش کنید.`)
      );
    }

    entry.count += 1;
    return next();
  };
}

module.exports = { signToken, authRequired, requireRole, adminOnly, createLoginRateLimiter, USER_COLUMNS };
