import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMISSION_RATES,
  formatAmount,
  formatMoney,
  parseAmount,
  previewCommission,
  rateForType,
  toLatin,
} from '../lib/money.js';

test('قالب‌بندی مبلغ با کاما سه‌رقمی', () => {
  assert.equal(formatAmount(1000000), '1,000,000');
  assert.equal(formatAmount(2500), '2,500');
  assert.equal(formatAmount(999), '999');
  assert.equal(formatAmount(0), '0');
  assert.equal(formatAmount(1234567890), '1,234,567,890');
  assert.equal(formatMoney(1500000), '1,500,000 تومان');
});

test('تبدیل ورودی کاربر (با کاما یا ارقام فارسی) به عدد', () => {
  assert.equal(parseAmount('1,000,000'), 1000000);
  assert.equal(parseAmount('۱٬۲۵۰٬۰۰۰'), 1250000);
  assert.equal(parseAmount(''), 0);
  assert.equal(parseAmount('abc'), 0);
  assert.equal(toLatin('۱۲۳'), '123');
});

test('درصد سهم امدادگر بر اساس نوع بار', () => {
  assert.equal(rateForType('transport'), 20);
  assert.equal(rateForType('onsite_repair'), 30);
  assert.equal(rateForType('garage_dispatch'), 30);
  assert.equal(COMMISSION_RATES.transport, 20);
});

test('پیش‌بینی سهم امدادگر مثل سرور محاسبه می‌شود', () => {
  assert.deepEqual(previewCommission(1000000, 'transport'), { rate: 20, amount: 200000 });
  assert.deepEqual(previewCommission(1000000, 'onsite_repair'), { rate: 30, amount: 300000 });
  assert.deepEqual(previewCommission('1,800,000', 'garage_dispatch'), { rate: 30, amount: 540000 });
  assert.deepEqual(previewCommission(0, 'transport'), { rate: 20, amount: 0 });
});
