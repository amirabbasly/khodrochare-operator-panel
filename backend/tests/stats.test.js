'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, tokenFor, shutdown, request } = require('./helpers');
const { todayStr, addDays } = require('../src/utils/dates');

let app;
let adminToken;
let operatorToken;

test.before(async () => {
  ({ app } = await bootstrap());
  adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');
  operatorToken = await tokenFor(app, 'ali.rezaei', 'operator12345', 'operator');
});

test.after(async () => {
  await shutdown();
});

test('آمار کلی شامل شهرها، محدوده‌ها و امدادگران است', async () => {
  const response = await request(app)
    .get('/api/stats/overview')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  const body = response.body;

  assert.ok(body.totals.loads > 0);
  assert.ok(body.totals.confirmed > 0);
  assert.ok(body.totals.cancelled > 0);
  assert.equal(body.totals.loads, body.totals.confirmed + body.totals.cancelled + body.totals.pending);
  assert.ok(body.zones.length > 0);
  assert.ok(body.cities.length > 0);
  assert.ok(body.counts.rescuers.total > 0);
  assert.ok(body.counts.operators.total > 0);
  assert.ok(body.topRescuers.confirmed.length > 0);
  assert.ok(body.cancelReasons.length > 0);
  assert.ok(body.trend.length >= 1);
  assert.ok(body.today.total >= 0);
});

test('مجموع بارهای شهرها با مجموع کل برابر است', async () => {
  const response = await request(app)
    .get('/api/stats/overview')
    .set('Authorization', `Bearer ${operatorToken}`);

  const cityTotal = response.body.cities.reduce((sum, city) => sum + city.total, 0);
  const zoneTotal = response.body.zones.reduce((sum, zone) => sum + zone.total, 0);

  assert.equal(cityTotal, response.body.totals.loads);
  assert.equal(zoneTotal, response.body.totals.loads);
});

test('فیلتر بازه تاریخ در آمار اعمال می‌شود', async () => {
  const today = await request(app)
    .get(`/api/stats/overview?from=${todayStr()}&to=${todayStr()}`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(today.status, 200);
  assert.equal(today.body.range.from, todayStr());
  assert.equal(today.body.trend.length, 1);
  assert.ok(today.body.totals.loads <= 40);
});

test('گزارش یک‌روزه نیز شهرها، محدوده‌ها و امدادگران را نشان می‌دهد', async () => {
  const response = await request(app)
    .get(`/api/stats/overview?from=${todayStr()}&to=${todayStr()}`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.totals.loads > 0);
  assert.ok(response.body.zones.length > 0, 'گزارش محدوده‌ها خالی است');
  assert.ok(response.body.cities.length > 0, 'گزارش شهرها خالی است');
  assert.ok(response.body.topRescuers.confirmed.length > 0, 'گزارش امدادگران خالی است');
  assert.ok(response.body.cancelReasons.length >= 0);
});

test('آمار تفصیلی اپراتورها ردیف‌های بار ثبت‌شده دارد', async () => {
  const response = await request(app)
    .get('/api/stats/operators')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.items.length >= 4);
  assert.ok(response.body.items.some((item) => item.total > 0));
});

test('تاریخ نامعتبر در آمار خطای 400 می‌دهد', async () => {
  const response = await request(app)
    .get('/api/stats/overview?from=1403-13-45')
    .set('Authorization', `Bearer ${tokenFor ? operatorToken : operatorToken}`);
  assert.equal(response.status, 400);
});

test('آمار تفصیلی فقط برای مدیر قابل دسترسی است', async () => {
  const forbidden = await request(app)
    .get('/api/stats/detailed')
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(forbidden.status, 403);

  const response = await request(app)
    .get(`/api/stats/detailed?from=${addDays(todayStr(), -30)}&to=${todayStr()}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.operators));
  assert.ok(response.body.operators.length >= 4);
  assert.ok(response.body.operators.some((operator) => operator.total > 0));
  assert.ok(Array.isArray(response.body.monthlyTrend));
  assert.ok(response.body.monthlyTrend.length >= 1);
});

test('آمار امروز با فیلتر تاریخ', async () => {
  const response = await request(app)
    .get(`/api/stats/today?date=${todayStr()}`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.date, todayStr());
  assert.equal(
    response.body.total,
    response.body.confirmed + response.body.cancelled + response.body.pending
  );
});

test('فهرست محدوده‌ها و شهرها برای فرم‌ها', async () => {
  const response = await request(app)
    .get('/api/meta/zones')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.items.length, 10);
  assert.ok(response.body.items.every((zone) => zone.cities.length > 0));
});

test('داده‌های کمکی شامل دلایل کنسلی و نوع کار است', async () => {
  const response = await request(app)
    .get('/api/meta/lookups')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.statuses.length, 3);
  assert.equal(response.body.workTypes.length, 4);
  assert.ok(response.body.cancelReasons.length > 0);
  assert.equal(response.body.today, todayStr());
});
