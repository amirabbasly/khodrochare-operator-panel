'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, tokenFor, shutdown, request } = require('./helpers');
const { todayStr, addDays } = require('../src/utils/dates');

let app;
let token;

test.before(async () => {
  ({ app } = await bootstrap());
  token = await tokenFor(app, 'sara.mohammadi', 'operator12345', 'operator');
});

test.after(async () => {
  await shutdown();
});

test('وضعیت روز بسته‌نشده و بستن روز', async () => {
  const day = addDays(todayStr(), -12);

  const before = await request(app)
    .get(`/api/days/${day}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(before.status, 200);
  assert.equal(before.body.isClosed, false);

  const closed = await request(app)
    .post(`/api/days/${day}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send({ note: 'بستن تستی' });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.isClosed, true);

  const again = await request(app)
    .post(`/api/days/${day}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(again.status, 409);

  const after = await request(app)
    .get(`/api/days/${day}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(after.body.isClosed, true);
  assert.ok(after.body.closedByName.includes('سارا'));
});

test('باز کردن روز بسته‌شده', async () => {
  const day = addDays(todayStr(), -13);
  await request(app)
    .post(`/api/days/${day}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  const reopened = await request(app)
    .post(`/api/days/${day}/reopen`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.isClosed, false);

  const missing = await request(app)
    .post(`/api/days/${day}/reopen`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(missing.status, 404);
});

test('فهرست روزهای بسته‌شده (شامل بسته‌شدن خودکار نمونه)', async () => {
  const response = await request(app)
    .get('/api/days')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.items.length >= 3);
  assert.ok(response.body.items.every((item) => typeof item.date === 'string'));
});

test('روز آینده قابل بستن نیست', async () => {
  const response = await request(app)
    .post(`/api/days/${addDays(todayStr(), 2)}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(response.status, 400);
});

test('ثبت بار در روز بسته‌شده ممنوع است', async () => {
  const day = addDays(todayStr(), -14);
  await request(app)
    .post(`/api/days/${day}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${token}`)
    .send({
      loadDate: day,
      vehicleName: 'سمند',
      customerPhone: '09121110000',
      carProblem: 'تست',
      customerName: 'تست روز بسته',
      rescuerName: 'امدادگر آزاد',
    });

  assert.equal(response.status, 409);
});
