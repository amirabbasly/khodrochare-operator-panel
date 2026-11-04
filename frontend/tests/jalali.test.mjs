import test from 'node:test';
import assert from 'node:assert/strict';
import {
  faToLatinDigits,
  isoToJalali,
  isoToJalaliInput,
  jalaliToISO,
  jalaliDateTimeLabel,
  latinToFaDigits,
  parseJalaliInput,
} from '../lib/jalali.js';

test('تبدیل ارقام فارسی/عربی به لاتین', () => {
  assert.equal(faToLatinDigits('۱۴۰۴/۰۸/۱۳'), '1404/08/13');
  assert.equal(faToLatinDigits('١٤٠٤'), '1404');
  assert.equal(latinToFaDigits('1404'), '۱۴۰۴');
});

test('میلادی به شمسی برای تاریخ‌های شناخته‌شده', () => {
  assert.deepEqual(isoToJalali('2025-03-21'), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(isoToJalali('2024-03-20'), { jy: 1403, jm: 1, jd: 1 });
  assert.equal(isoToJalali('not-a-date'), null);
});

test('شمسی به میلادی (رفت و برگشت)', () => {
  assert.equal(jalaliToISO(1404, 1, 1), '2025-03-21');
  assert.equal(jalaliToISO(1403, 12, 30), '2025-03-20');
  assert.equal(jalaliToISO(1404, 8, 13), '2025-11-04');
});

test('ورودی شمسی با ارقام فارسی و جداکننده‌های مختلف پذیرفته می‌شود', () => {
  assert.equal(parseJalaliInput('۱۴۰۴/۰۸/۱۳'), '2025-11-04');
  assert.equal(parseJalaliInput('1404-8-13'), '2025-11-04');
  assert.equal(parseJalaliInput('1404.08.13'), '2025-11-04');
  assert.equal(parseJalaliInput('۱۴۰۴/۱۳/۴۰'), null);
  assert.equal(parseJalaliInput(''), null);
});

test('نمایش تاریخ شمسی در ورودی', () => {
  assert.equal(isoToJalaliInput('2025-11-04'), '۱۴۰۴/۰۸/۱۳');
  assert.equal(isoToJalaliInput(''), '');
});

test('برچسب تاریخ و ساعت شمسی برای جدول‌ها', () => {
  const label = jalaliDateTimeLabel('2025-11-04T09:05:00.000Z');
  assert.match(label, /۱۴۰۴\/۰۸\/۱۳/);
  assert.match(label, /·/);
  assert.equal(jalaliDateTimeLabel(null), '—');
  assert.equal(jalaliDateTimeLabel('invalid'), '—');
});
