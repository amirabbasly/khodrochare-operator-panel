'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, tokenFor, shutdown, request } = require('./helpers');

let app;
let operatorToken;
let adminToken;
let rescuerId;

test.before(async () => {
  ({ app } = await bootstrap());
  operatorToken = await tokenFor(app, 'ali.rezaei', 'operator12345', 'operator');
  adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  const rescuers = await request(app)
    .get('/api/rescuers?limit=1')
    .set('Authorization', `Bearer ${operatorToken}`);
  rescuerId = rescuers.body.items[0].id;
});

test.after(async () => {
  await shutdown();
});

const baseLoad = (overrides = {}) => ({
  vehicleName: 'پژو پارس',
  customerPhone: '09121112233',
  carProblem: 'خاموش شدن خودرو',
  customerName: 'کریم مالی',
  rescuerId,
  address: 'محمودآباد، خیابان ۲۲ بهمن',
  status: 'confirmed',
  followUp: 'done',
  ...overrides,
});

test('نوع حملی: سهم امدادگر ۲۰٪ مبلغ دریافتی است', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(baseLoad({ amountReceived: 1000000, loadType: 'transport' }));

  assert.equal(response.status, 201);
  assert.equal(response.body.item.amountReceived, 1000000);
  assert.equal(response.body.item.loadType, 'transport');
  assert.equal(response.body.item.commissionRate, 20);
  assert.equal(response.body.item.commissionAmount, 200000);
  assert.equal(response.body.item.isPaid, false);
  assert.equal(response.body.item.paidAmount, null);
});

test('نوع تعمیر در محل: سهم امدادگر ۳۰٪ است', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(baseLoad({ amountReceived: 1000000, loadType: 'onsite_repair' }));

  assert.equal(response.status, 201);
  assert.equal(response.body.item.commissionRate, 30);
  assert.equal(response.body.item.commissionAmount, 300000);
});

test('امکان اعزام به تعمیرگاه: درصد ثابت و ثبت وضعیت اعزام', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(
      baseLoad({ amountReceived: 2000000, loadType: 'garage_dispatch', garageDispatched: true })
    );

  assert.equal(response.status, 201);
  assert.equal(response.body.item.loadTypeLabel, 'امکان اعزام به تعمیرگاه');
  assert.equal(response.body.item.commissionRate, 30);
  assert.equal(response.body.item.commissionAmount, 600000);
  assert.equal(response.body.item.garageDispatched, true);
});

test('تغییر مبلغ یا نوع بار، سهم امدادگر را بازمحاسبه می‌کند', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(baseLoad({ amountReceived: 500000, loadType: 'transport' }));

  const updated = await request(app)
    .patch(`/api/loads/${created.body.item.id}`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ amountReceived: 900000, loadType: 'onsite_repair' });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.item.amountReceived, 900000);
  assert.equal(updated.body.item.commissionRate, 30);
  assert.equal(updated.body.item.commissionAmount, 270000);
});

test('مبلغ منفی پذیرفته نمی‌شود', async () => {
  const response = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(baseLoad({ amountReceived: -5, loadType: 'transport' }));

  assert.equal(response.status, 400);
});

test('ثبت پرداخت: وضعیت، مبلغ و ثبت‌کننده ذخیره می‌شود', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(baseLoad({ amountReceived: 1500000, loadType: 'transport' }));

  const paid = await request(app)
    .patch(`/api/loads/${created.body.item.id}/payment`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ isPaid: true });

  assert.equal(paid.status, 200);
  assert.equal(paid.body.item.isPaid, true);
  assert.equal(paid.body.item.paidAmount, 300000);
  assert.equal(paid.body.item.paidByUsername, 'ali.rezaei');
  assert.ok(paid.body.item.paidAt);

  const unpaid = await request(app)
    .patch(`/api/loads/${created.body.item.id}/payment`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isPaid: false });

  assert.equal(unpaid.body.item.isPaid, false);
  assert.equal(unpaid.body.item.paidAmount, null);
});

test('اطلاعات مالی هر امدادگر (کارکرد، پرداخت‌شده، مانده) محاسبه می‌شود', async () => {
  const created = await request(app)
    .post('/api/loads')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send(baseLoad({ amountReceived: 1000000, loadType: 'transport' }));

  await request(app)
    .patch(`/api/loads/${created.body.item.id}/payment`)
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({ isPaid: true });

  const response = await request(app)
    .get(`/api/rescuers/${rescuerId}`)
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  const stats = response.body.item.stats;
  assert.ok(stats.billedAmount >= 200000);
  assert.ok(stats.paidAmount >= 200000);
  assert.equal(stats.unpaidAmount, Math.max(0, stats.billedAmount - stats.paidAmount));
});

test('خلاصه‌ی مالی داشبورد و گزارش‌ها محاسبه می‌شود', async () => {
  const overview = await request(app)
    .get('/api/stats/overview')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(overview.status, 200);
  assert.ok(overview.body.finance.received > 0);
  assert.ok(overview.body.finance.commission > 0);
  assert.equal(overview.body.finance.byType.length, 3);
  assert.ok(overview.body.finance.byType.some((item) => item.loadType === 'transport'));

  const detailed = await request(app)
    .get('/api/stats/detailed')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detailed.status, 200);
  assert.ok(Array.isArray(detailed.body.unpaidRescuers));
});

test('خروجی CSV ستون‌های مالی را دارد', async () => {
  const response = await request(app)
    .get('/api/loads/export')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.text.includes('مبلغ دریافتی'));
  assert.ok(response.text.includes('سهم امدادگر'));
  assert.ok(response.text.includes('پرداخت‌شده'));
});

test('فیلتر پرداخت‌شده/پرداخت‌نشده کار می‌کند', async () => {
  const paid = await request(app)
    .get('/api/loads?paid=true&limit=50')
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(paid.status, 200);
  assert.ok(paid.body.items.every((item) => item.isPaid === true));

  const unpaid = await request(app)
    .get('/api/loads?paid=false&limit=50')
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(unpaid.status, 200);
  assert.ok(unpaid.body.items.every((item) => item.isPaid === false));
});
