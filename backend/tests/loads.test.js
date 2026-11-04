'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, tokenFor, shutdown, request } = require('./helpers');
const { todayStr, addDays } = require('../src/utils/dates');

let app;
let operatorToken;
let adminToken;
let cityId;
let rescuerId;

test.before(async () => {
  ({ app } = await bootstrap());
  operatorToken = await tokenFor(app, 'ali.rezaei', 'operator12345', 'operator');
  adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  const zones = await request(app).get('/api/meta/zones').set('Authorization', `Bearer ${operatorToken}`);
  cityId = zones.body.items.find((zone) => zone.name === 'مرکز مازندران').cities[0].id;

  const rescuers = await request(app)
    .get('/api/rescuers?limit=1')
    .set('Authorization', `Bearer ${operatorToken}`);
  rescuerId = rescuers.body.items[0].id;
});

test.after(async () => {
  await shutdown();
});

const validPayload = () => ({
  vehicleName: 'پژو ۲۰۶',
  customerPhone: '09121234567',
  carProblem: 'روشن نشدن خودرو',
  customerName: 'محمود تستی',
  rescuerId,
  cityId,
  address: 'محمودآباد، خیابان اصلی',
  description: 'تست ایجاد بار',
  status: 'pending',
  followUp: 'not_done',
});

test('ثبت بار جدید با اطلاعات معتبر', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validPayload());

  assert.equal(response.status, 201);
  assert.equal(response.body.item.customerName, 'محمود تستی');
  assert.equal(response.body.item.cityName, 'آمل');
  assert.equal(response.body.item.zoneName, 'مرکز مازندران');
  assert.ok(response.body.item.rescuerName);
  assert.equal(response.body.item.status, 'pending');
  assert.equal(response.body.item.loadDate, todayStr());
});

test('شماره تماس نامعتبر رد می‌شود', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validPayload(), customerPhone: '12345' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('ثبت بار بدون امدادگر رد می‌شود', async () => {
  const payload = validPayload();
  delete payload.rescuerId;
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(payload);

  assert.equal(response.status, 400);
});

test('ثبت بار کنسل‌شده بدون دلیل کنسلی رد می‌شود', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validPayload(), status: 'cancelled' });

  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /دلیل کنسلی/);
});

test('فهرست بارها با فیلتر تاریخ و جست‌وجو کار می‌کند', async () => {
  const today = await request(app)
    .get(`/api/loads?date=${todayStr()}&limit=5`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(today.status, 200);
  assert.ok(today.body.items.length > 0);
  assert.ok(today.body.items.every((item) => item.loadDate === todayStr()));
  assert.ok(today.body.summary.total >= today.body.items.length);

  const search = await request(app)
    .get('/api/loads?q=محمودآباد&limit=50')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(search.status, 200);
  assert.ok(search.body.items.length > 0);
  assert.ok(
    search.body.items.every((item) =>
      [item.address, item.cityName, item.zoneName].join(' ').includes('محمودآباد')
    )
  );
});

test('تغییر وضعیت بار به تایید و کنسل', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validPayload());
  const id = created.body.item.id;

  const confirmed = await request(app)
    .patch(`/api/loads/${id}/status`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ status: 'confirmed' });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.item.status, 'confirmed');

  const withoutReason = await request(app)
    .patch(`/api/loads/${id}/status`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ status: 'cancelled' });
  assert.equal(withoutReason.status, 400);

  const cancelled = await request(app)
    .patch(`/api/loads/${id}/status`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ status: 'cancelled', cancelReason: 'لغو توسط امدادخواه' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.item.status, 'cancelled');
  assert.equal(cancelled.body.item.cancelReason, 'لغو توسط امدادخواه');
});

test('پیگیری انجام شد / نشد قابل تغییر است', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validPayload());

  const done = await request(app)
    .patch(`/api/loads/${created.body.item.id}/follow-up`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ followUp: 'done' });

  assert.equal(done.status, 200);
  assert.equal(done.body.item.followUp, 'done');
  assert.equal(done.body.item.followUpLabel, 'پیگیری انجام شد');

  const invalid = await request(app)
    .patch(`/api/loads/${created.body.item.id}/follow-up`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ followUp: 'whatever' });
  assert.equal(invalid.status, 400);
});

test('ویرایش اطلاعات بار توسط اپراتور', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validPayload());

  const updated = await request(app)
    .patch(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ carProblem: 'باتری خوابیده', description: 'ویرایش شد' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.item.carProblem, 'باتری خوابیده');
  assert.equal(updated.body.item.description, 'ویرایش شد');
});

test('روزهای بسته‌شده قابل ویرایش نیستند', async () => {
  const closedDay = addDays(todayStr(), -10);

  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validPayload(), loadDate: closedDay });
  assert.equal(created.status, 201);

  const close = await request(app)
    .post(`/api/days/${closedDay}/close`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ note: 'پایان روز' });
  assert.equal(close.status, 200);

  const blocked = await request(app)
    .patch(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ carProblem: 'تغییر غیرمجاز' });
  assert.equal(blocked.status, 409);

  const reopen = await request(app)
    .post(`/api/days/${closedDay}/reopen`)
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(reopen.status, 200);

  const allowed = await request(app)
    .patch(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ carProblem: 'تغییر مجاز' });
  assert.equal(allowed.status, 200);
});

test('حذف بار فقط برای مدیر مجاز است', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validPayload());

  const forbidden = await request(app)
    .delete(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(forbidden.status, 403);

  const deleted = await request(app)
    .delete(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleted.status, 200);

  const missing = await request(app)
    .get(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(missing.status, 404);
});

test('خروجی CSV بارها ساخته می‌شود', async () => {
  const response = await request(app)
    .get('/api/loads/export')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/csv/);
  assert.ok(response.text.includes('شماره تماس'));
});

test('ثبت بار با شهر و محدوده‌ی تایپ‌شده توسط اپراتور', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      ...validPayload(),
      cityId: null,
      cityName: 'شهر تایپی تست',
      zoneName: 'محدوده‌ی تایپی تست',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.item.cityName, 'شهر تایپی تست');
  assert.equal(response.body.item.zoneName, 'محدوده‌ی تایپی تست');
});

test('فیلتر پیگیری انجام‌شده/نشده و شمارش هر دو حالت', async () => {
  const done = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validPayload(), followUp: 'done' });
  assert.equal(done.status, 201);

  const notDone = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validPayload(), followUp: 'not_done' });
  assert.equal(notDone.status, 201);

  const doneList = await request(app)
    .get('/api/loads?followUp=done&limit=200')
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(doneList.status, 200);
  assert.ok(doneList.body.items.every((item) => item.followUp === 'done'));
  assert.ok(doneList.body.items.some((item) => item.id === done.body.item.id));

  const notDoneList = await request(app)
    .get('/api/loads?followUp=not_done&limit=200')
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(notDoneList.status, 200);
  assert.ok(notDoneList.body.items.every((item) => item.followUp === 'not_done'));

  assert.ok(doneList.body.summary.followUpDone >= 1);
  assert.ok(notDoneList.body.summary.followUpNotDone >= 1);
});
