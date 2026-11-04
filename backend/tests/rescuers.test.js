'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, tokenFor, shutdown, request } = require('./helpers');

let app;
let operatorToken;
let adminToken;
let zoneId;
let cityId;

test.before(async () => {
  ({ app } = await bootstrap());
  operatorToken = await tokenFor(app, 'ali.rezaei', 'operator12345', 'operator');
  adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  const zones = await request(app).get('/api/meta/zones').set('Authorization', `Bearer ${operatorToken}`);
  const zone = zones.body.items.find((item) => item.name === 'تهران');
  zoneId = zone.id;
  cityId = zone.cities[0].id;
});

test.after(async () => {
  await shutdown();
});

const validRescuer = () => ({
  firstName: 'کامبیز',
  lastName: 'تست‌زاده',
  phone: '09123334455',
  vehicle: 'نیسان زامیاد',
  plate: '۱۲الف۳۴۵-۱۱',
  zoneId,
  cityId,
  workType: 'garage',
});

test('جست‌وجوی نام کامل امدادگر (بدون فاصله) نتیجه می‌دهد', async () => {
  const response = await request(app)
    .get('/api/rescuers?q=امیرکریمی')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.items.length >= 1);
  assert.equal(response.body.items[0].fullName, 'امیر کریمی');
});

test('جست‌وجو بر اساس شهر فعالیت امدادگران را برمی‌گرداند', async () => {
  const response = await request(app)
    .get('/api/rescuers?q=محمودآباد')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.items.length >= 1);
  assert.ok(response.body.items.every((item) => item.cityName === 'محمودآباد'));
});

test('فیلتر نوع کار و وضعیت امدادگر', async () => {
  const garages = await request(app)
    .get('/api/rescuers?workType=garage')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(garages.status, 200);
  assert.ok(garages.body.items.length >= 3);
  assert.ok(garages.body.items.every((item) => item.workType === 'garage' && item.isSpecial));
});

test('ثبت امدادگر جدید', async () => {
  const response = await request(app)
    .post('/api/rescuers')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validRescuer());

  assert.equal(response.status, 201);
  assert.equal(response.body.item.fullName, 'کامبیز تست‌زاده');
  assert.equal(response.body.item.workTypeLabel, 'تعمیرگاهی');
  assert.equal(response.body.item.isSpecial, true);
  assert.equal(response.body.item.zoneName, 'تهران');
});

test('ثبت امدادگر با نوع کار نامعتبر رد می‌شود', async () => {
  const response = await request(app)
    .post('/api/rescuers')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validRescuer(), workType: 'unknown' });

  assert.equal(response.status, 400);
});

test('ویرایش امدادگر و تغییر محدوده فعالیت', async () => {
  const created = await request(app)
    .post('/api/rescuers')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(validRescuer());
  const id = created.body.item.id;

  const zones = await request(app).get('/api/meta/zones').set('Authorization', `Bearer ${operatorToken}`);
  const gilan = zones.body.items.find((item) => item.name === 'گیلان');

  const updated = await request(app)
    .patch(`/api/rescuers/${id}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ cityId: gilan.cities[0].id, workType: 'both' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.item.zoneName, 'گیلان');
  assert.equal(updated.body.item.workType, 'both');
});

test('امدادگر دارای بار قابل حذف نیست و مدیر می‌تواند امدادگر بدون بار را حذف کند', async () => {
  const zones = await request(app).get('/api/meta/zones').set('Authorization', `Bearer ${operatorToken}`);
  const city = zones.body.items[0].cities[0];

  const created = await request(app)
    .post('/api/rescuers')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validRescuer(), plate: '۹۹ب۹۹۹-۱۱', cityId: city.id, zoneId: zones.body.items[0].id });

  const withLoad = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      vehicleName: 'سمند',
      customerPhone: '09121112233',
      carProblem: 'پنچری',
      customerName: 'آزمون حذف',
      rescuerId: created.body.item.id,
      cityId: city.id,
    });
  assert.equal(withLoad.status, 201);

  const blocked = await request(app)
    .delete(`/api/rescuers/${created.body.item.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(blocked.status, 409);

  const freeRescuer = await request(app)
    .post('/api/rescuers')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validRescuer(), plate: '۱۱ج۱۱۱-۱۱' });

  const removed = await request(app)
    .delete(`/api/rescuers/${freeRescuer.body.item.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(removed.status, 200);
});

test('اپراتور اجازه حذف امدادگر ندارد', async () => {
  const created = await request(app)
    .post('/api/rescuers')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ ...validRescuer(), plate: '۲۲د۲۲۲-۱۱' });

  const response = await request(app)
    .delete(`/api/rescuers/${created.body.item.id}`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 403);
});

test('جزئیات امدادگر همراه آمار و آخرین بارها برمی‌گردد', async () => {
  const list = await request(app)
    .get('/api/rescuers?q=امیرکریمی')
    .set('Authorization', `Bearer ${operatorToken}`);
  const id = list.body.items[0].id;

  const details = await request(app)
    .get(`/api/rescuers/${id}`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(details.status, 200);
  assert.ok(details.body.item.stats.total > 0);
  assert.ok(Array.isArray(details.body.recentLoads));
});
