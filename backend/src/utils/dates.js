'use strict';

const config = require('../config');

/**
 * تاریخ «امروز» بر اساس منطقه‌ی زمانی برنامه (پیش‌فرض: Asia/Tehran)
 * خروجی: رشته‌ی YYYY-MM-DD
 */
function todayStr(tz = config.timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** تبدیل امن هر مقدار تاریخ به YYYY-MM-DD */
function toDateStr(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  return str.length > 10 ? str.slice(0, 10) : str;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function diffDays(from, to) {
  const a = Date.UTC(...from.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  const b = Date.UTC(...to.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  return Math.round((b - a) / 86400000);
}

function monthOf(dateStr) {
  return String(dateStr).slice(0, 7);
}

function startOfMonth(dateStr = todayStr()) {
  return `${String(dateStr).slice(0, 7)}-01`;
}

/** بازه‌ی پیش‌فرض آمار: از ابتدای ماه جاری تا امروز */
function defaultRange() {
  const to = todayStr();
  return { from: startOfMonth(to), to };
}

function clampRange(from, to) {
  const end = to || todayStr();
  const start = from || addDays(end, -29);
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

module.exports = {
  todayStr,
  isDateStr,
  toDateStr,
  addDays,
  diffDays,
  monthOf,
  startOfMonth,
  defaultRange,
  clampRange,
};
