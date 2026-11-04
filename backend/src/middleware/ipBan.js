'use strict';

const { getDb } = require('../db');
const { ApiError, asyncHandler } = require('../utils/http');
const security = require('../services/security');
const { clientIp } = require('../services/loginGuard');

/**
 * هر درخواست API از یک IP مسدودشده رد می‌شود.
 * (IP مسدود فقط از پنل مدیریت و با حساب مدیر قابل رفع است)
 */
const ipBanGuard = asyncHandler(async (req, _res, next) => {
  const ip = clientIp(req);

  // سلامت سرویس و مسیر ورود باید پاسخ دهند تا مدیر بتواند وضعیت را ببیند
  if (req.path === '/api/health') return next();

  const db = await getDb();
  const banned = await security.isBanned(db, ip);

  if (!banned) return next();

  throw new ApiError(
    403,
    'دسترسی این شبکه به‌دلیل فعالیت مشکوک مسدود شده است. با مدیر سیستم تماس بگیرید.',
    'IP_BANNED'
  );
});

module.exports = { ipBanGuard };
