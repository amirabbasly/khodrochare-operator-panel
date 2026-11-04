'use strict';

const config = require('../config');
const { ApiError } = require('../utils/http');

/**
 * محافظ ورود:
 *  ۱) محدودیت نرخ بر اساس IP (ضد حمله‌ی توزیع‌شده به یک حساب)
 *  ۲) محدودیت نرخ بر اساس «IP + نام کاربری»
 *  ۳) قفل موقت حساب در پایگاه داده پس از چند بار رمز اشتباه
 *
 * این لایه فقط تلاش‌های *ناموفق* را می‌شمارد؛ ورود موفق شمارنده را صفر می‌کند.
 */

const IP_WINDOW_MS = Number(process.env.LOGIN_IP_WINDOW_MS || 15 * 60 * 1000);
const IP_MAX_FAILURES = Number(process.env.LOGIN_IP_MAX_FAILURES || 20);
const PAIR_MAX_FAILURES = Number(process.env.LOGIN_PAIR_MAX_FAILURES || 10);
const ACCOUNT_MAX_FAILURES = Number(process.env.LOGIN_ACCOUNT_MAX_FAILURES || 5);
const ACCOUNT_LOCK_MINUTES = Number(process.env.LOGIN_ACCOUNT_LOCK_MINUTES || 15);

const failures = new Map();

function nowMs() {
  return Date.now();
}

function bump(key, windowMs) {
  const now = nowMs();
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function current(key) {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (entry.resetAt <= nowMs()) {
    failures.delete(key);
    return 0;
  }
  return entry.count;
}

function minutesLeft(key) {
  const entry = failures.get(key);
  if (!entry) return 1;
  return Math.max(1, Math.ceil((entry.resetAt - nowMs()) / 60000));
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function assertIpAllowed(req) {
  if (config.isTest) return;
  const ipKey = `ip:${clientIp(req)}`;
  if (current(ipKey) >= IP_MAX_FAILURES) {
    throw new ApiError(
      429,
      `تلاش‌های ناموفق از این شبکه زیاد بوده است؛ ${minutesLeft(ipKey)} دقیقه‌ی دیگر دوباره تلاش کنید.`,
      'TOO_MANY_ATTEMPTS'
    );
  }
}

function assertPairAllowed(req, username) {
  if (config.isTest) return;
  const pairKey = `pair:${clientIp(req)}:${String(username || '').toLowerCase()}`;
  if (current(pairKey) >= PAIR_MAX_FAILURES) {
    throw new ApiError(
      429,
      `تلاش‌های ناموفق برای این حساب زیاد بوده است؛ ${minutesLeft(pairKey)} دقیقه‌ی دیگر تلاش کنید.`,
      'TOO_MANY_ATTEMPTS'
    );
  }
}

function registerFailure(req, username) {
  bump(`ip:${clientIp(req)}`, IP_WINDOW_MS);
  bump(`pair:${clientIp(req)}:${String(username || '').toLowerCase()}`, IP_WINDOW_MS);
}

function ipFailureCount(req) {
  return current(`ip:${clientIp(req)}`);
}

function registerSuccess(req, username) {
  failures.delete(`pair:${clientIp(req)}:${String(username || '').toLowerCase()}`);
}

function accountLockedMinutes(user) {
  if (!user?.locked_until) return 0;
  const until = new Date(user.locked_until).getTime();
  if (Number.isNaN(until) || until <= nowMs()) return 0;
  return Math.max(1, Math.ceil((until - nowMs()) / 60000));
}

function nextAttemptState(currentFailures) {
  const attempts = Number(currentFailures || 0) + 1;
  if (attempts >= ACCOUNT_MAX_FAILURES) {
    return {
      failedAttempts: 0,
      lockedUntil: new Date(nowMs() + ACCOUNT_LOCK_MINUTES * 60000),
      locked: true,
    };
  }
  return { failedAttempts: attempts, lockedUntil: null, locked: false };
}

module.exports = {
  ACCOUNT_MAX_FAILURES,
  ACCOUNT_LOCK_MINUTES,
  clientIp,
  assertIpAllowed,
  assertPairAllowed,
  registerFailure,
  ipFailureCount,
  registerSuccess,
  accountLockedMinutes,
  nextAttemptState,
  _resetForTests: () => failures.clear(),
};
