import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLLOW_UPS,
  NAV_ITEMS,
  STATUSES,
  WORK_TYPES,
  WORK_TYPE_MAP,
  STATUS_MAP,
} from '../lib/constants.js';

test('چهار نوع کار امدادگر تعریف شده است', () => {
  assert.equal(WORK_TYPES.length, 4);
  const values = WORK_TYPES.map((item) => item.value);
  assert.deepEqual(values, ['transport', 'onsite_repair', 'both', 'garage']);
  assert.equal(WORK_TYPE_MAP.garage.label, 'تعمیرگاهی');
});

test('سه وضعیت بار و دو وضعیت پیگیری وجود دارد', () => {
  assert.deepEqual(
    STATUSES.map((item) => item.value),
    ['pending', 'confirmed', 'cancelled']
  );
  assert.equal(STATUS_MAP.confirmed.tone, 'success');
  assert.equal(FOLLOW_UPS.length, 2);
});

test('منوی اپراتور بخش‌های مدیریتی را نمی‌بیند', () => {
  const operatorItems = NAV_ITEMS.filter((item) => item.roles.includes('operator')).map((item) => item.href);
  assert.ok(operatorItems.includes('/loads'));
  assert.ok(operatorItems.includes('/rescuers'));
  assert.ok(!operatorItems.includes('/operators'));
  assert.ok(!operatorItems.includes('/reports'));

  const adminItems = NAV_ITEMS.filter((item) => item.roles.includes('admin')).map((item) => item.href);
  assert.ok(adminItems.includes('/operators'));
  assert.ok(adminItems.includes('/reports'));
});
