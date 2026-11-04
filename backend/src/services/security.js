'use strict';

const config = require('../config');

/**
 * مدیریت IPهای مسدودشده:
 *  - تله‌ی ورود (decoy): هرکس با «نام کاربری/رمز ادمین فیک» وارد شود مسدود می‌شود.
 *  - بروت‌فورس: بعد از تعداد مشخصی تلاش ناموفق ورود، IP خودکار مسدود می‌شود.
 *
 * بررسی مسدود بودن با یک کش کوتاه‌مدت انجام می‌شود تا روی هر درخواست
 * یک کوئری اضافه به پایگاه داده تحمیل نشود.
 */

const CACHE_TTL_MS = Number(process.env.BAN_CACHE_TTL_MS || 15000);

let cache = { at: 0, ips: new Set() };
let tableReady = false;

/**
 * ساخت جدول banned_ips در صورت نبود (خودترمیمی).
 * روی نصب‌هایی که مهاجرت هنگام بالا آمدن اجرا نشده است، این تابع
 * بار اول که امنیت لازم شود جدول را می‌سازد تا API با خطای 500 نخوابد.
 */
async function ensureBanTable(db) {
  if (tableReady) return true;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS banned_ips (
      ip VARCHAR(64) PRIMARY KEY,
      reason VARCHAR(40) NOT NULL DEFAULT 'decoy_credentials',
      username VARCHAR(60),
      user_agent TEXT,
      attempts INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    tableReady = true;
    return true;
  } catch (error) {
    console.warn(`⚠️ ساخت جدول banned_ips ناموفق بود: ${error.message}`);
    return false;
  }
}

function invalidateCache() {
  cache = { at: 0, ips: new Set() };
}

function normalizeIp(value) {
  const ip = String(value || '').trim();
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip === '::1' ? '127.0.0.1' : ip;
}

async function bannedSet(db) {
  const now = Date.now();
  if (cache.at && now - cache.at < CACHE_TTL_MS) return cache.ips;

  try {
    await ensureBanTable(db);
    const rows = await db.many('SELECT ip FROM banned_ips WHERE is_active = TRUE');
    cache = { at: now, ips: new Set(rows.map((row) => normalizeIp(row.ip))) };
  } catch {
    // اگر جدول هنوز ساخته نشده، هیچ IPای مسدود نیست
    cache = { at: now, ips: new Set() };
  }
  return cache.ips;
}

async function isBanned(db, ip) {
  const target = normalizeIp(ip);
  if (!target) return false;
  const set = await bannedSet(db);
  return set.has(target);
}

/** مسدودسازی (یا به‌روزرسانی) یک IP */
async function banIp(db, { ip, reason = 'decoy_credentials', username = null, userAgent = null }) {
  const target = normalizeIp(ip);
  if (!target) return null;

  const safeReason = String(reason).slice(0, 40);
  const safeUsername = username ? String(username).slice(0, 60) : null;
  const safeAgent = userAgent ? String(userAgent).slice(0, 300) : null;

  const ready = await ensureBanTable(db);
  if (!ready) return null;

  const existing = await db.one('SELECT ip FROM banned_ips WHERE ip = $1', [target]);

  if (existing) {
    await db.query(
      `UPDATE banned_ips
          SET attempts = attempts + 1, last_seen_at = NOW(), is_active = TRUE,
              reason = $2, username = COALESCE($3, username), user_agent = COALESCE($4, user_agent)
        WHERE ip = $1`,
      [target, safeReason, safeUsername, safeAgent]
    );
  } else {
    await db.query(
      `INSERT INTO banned_ips (ip, reason, username, user_agent, attempts, is_active)
       VALUES ($1, $2, $3, $4, 1, TRUE)`,
      [target, safeReason, safeUsername, safeAgent]
    );
  }

  invalidateCache();
  return target;
}

async function unbanIp(db, ip) {
  const target = normalizeIp(ip);
  await ensureBanTable(db);
  await db.query('UPDATE banned_ips SET is_active = FALSE WHERE ip = $1', [target]);
  invalidateCache();
  return target;
}

/** آیا مشخصات ارسالی همان «حساب تله» است؟ */
function isDecoyAttempt({ username, password }) {
  const decoyUser = String(config.decoy.username || '').trim().toLowerCase();
  const decoyPass = String(config.decoy.password || '');
  const givenUser = String(username || '').trim().toLowerCase();
  const givenPass = String(password || '');

  if (!decoyUser && !decoyPass) return false;
  if (decoyUser && givenUser === decoyUser) return true;
  if (decoyPass && givenPass === decoyPass) return true;
  return false;
}

module.exports = {
  normalizeIp,
  ensureBanTable,
  isBanned,
  banIp,
  unbanIp,
  isDecoyAttempt,
  invalidateCache,
};
