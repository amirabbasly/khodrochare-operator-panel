'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db');
const { ApiError, asyncHandler } = require('../utils/http');

const USER_COLUMNS =
  'id, first_name, last_name, username, phone, national_id, role, is_active, last_login_at, created_at, updated_at, token_version';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
      // با هر تغییر رمز توسط مدیر یک واحد بالا می‌رود ⇒ همه‌ی نشست‌های قبلی باطل می‌شوند
      tv: Number(user.token_version || 0),
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' }
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
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
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

  // رمز عبور بعد از صدور توکن عوض شده است ⇒ نشست باید باطل شود
  if (Number(payload.tv || 0) !== Number(row.token_version || 0)) {
    throw ApiError.unauthorized('رمز عبور این حساب تغییر کرده است؛ دوباره وارد شوید.');
  }

  delete row.token_version;
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

module.exports = { signToken, authRequired, requireRole, adminOnly, USER_COLUMNS };
