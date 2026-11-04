import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysISO,
  faDate,
  faDateTime,
  faDigitsToLatin,
  faNumber,
  faPercent,
  initials,
  normalizePhoneInput,
  toDateInput,
  todayISO,
} from '../lib/format.js';

test('faNumber اعداد را به فارسی تبدیل می‌کند', () => {
  assert.equal(faNumber(1234), '۱٬۲۳۴');
  assert.equal(faNumber(0), '۰');
  assert.equal(faNumber(null), '۰');
});

test('faPercent درصد را با علامت فارسی نشان می‌دهد', () => {
  assert.equal(faPercent(12.34), '۱۲٫۳٪');
});

test('faDigitsToLatin ارقام فارسی و عربی را تبدیل می‌کند', () => {
  assert.equal(faDigitsToLatin('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(faDigitsToLatin('٠٩١٢'), '0912');
  assert.equal(faDigitsToLatin('abc123'), 'abc123');
});

test('normalizePhoneInput فقط ارقام را نگه می‌دارد و به ۱۱ رقم محدود می‌کند', () => {
  assert.equal(normalizePhoneInput('۰۹۱۲-۳۴۵ ۶۷۸۹'), '09123456789');
  assert.equal(normalizePhoneInput('0912345678999'), '09123456789');
});

test('toDateInput فقط بخش تاریخ را برمی‌گرداند', () => {
  assert.equal(toDateInput('2026-11-04T10:20:30.000Z'), '2026-11-04');
  assert.equal(toDateInput(null), '');
});

test('faDate تاریخ میلادی را به شمسی تبدیل می‌کند', () => {
  const formatted = faDate('2026-11-04');
  assert.match(formatted, /آبان/);
  assert.match(formatted, /۱۴۰۵/);
});

test('faDate برای مقدار خالی خط تیره برمی‌گرداند', () => {
  assert.equal(faDate(null), '—');
  assert.equal(faDateTime(null), '—');
});

test('todayISO قالب YYYY-MM-DD دارد', () => {
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('addDaysISO محاسبه‌ی درست انجام می‌دهد', () => {
  assert.equal(addDaysISO('2026-01-01', -1), '2025-12-31');
  assert.equal(addDaysISO('2026-02-28', 1), '2026-03-01');
  assert.equal(addDaysISO('2026-11-04', 7), '2026-11-11');
});

test('initials حروف اول نام را می‌سازد', () => {
  assert.equal(initials('امیر کریمی'), 'اک');
  assert.equal(initials(''), '+');
  assert.equal(initials('محمود'), 'مح');
});
