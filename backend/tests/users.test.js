'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, login, tokenFor, shutdown, request } = require('./helpers');

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

const newOperator = () => ({
  firstName: 'سمیرا',
  lastName: 'آزمایشی',
  username: 'samira.test',
  password: 'samira12345',
  phone: '09127778899',
  nationalId: '0012345679',
});

test('اپراتور به بخش مدیریت کاربران دسترسی ندارد', async () => {
  const response = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(response.status, 403);
});

test('فهرست اپراتورها همراه آمار بارها', async () => {
  const response = await request(app)
    .get('/api/users?role=operator')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.ok(response.body.items.length >= 4);
  assert.ok(response.body.items.every((item) => item.role === 'operator'));
  assert.ok(response.body.items.some((item) => item.stats.total > 0));
});

test('ساخت اپراتور جدید و ورود با آن', async () => {
  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(newOperator());

  assert.equal(created.status, 201);
  assert.equal(created.body.item.username, 'samira.test');

  const session = await login(app, 'samira.test', 'samira12345', 'operator');
  assert.equal(session.status, 200);
  assert.equal(session.body.user.fullName, 'سمیرا آزمایشی');
});

test('نام کاربری تکراری رد می‌شود', async () => {
  const response = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...newOperator(), nationalId: '0013542419' });

  assert.equal(response.status, 409);
});

test('کد ملی نامعتبر رد می‌شود', async () => {
  const response = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...newOperator(), username: 'bad.nid', nationalId: '1234567890' });

  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /کد ملی/);
});

test('غیرفعال‌سازی اپراتور مانع ورود او می‌شود', async () => {
  const list = await request(app)
    .get('/api/users?q=samira')
    .set('Authorization', `Bearer ${adminToken}`);
  const id = list.body.items[0].id;

  const disabled = await request(app)
    .patch(`/api/users/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isActive: false });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.item.isActive, false);

  const session = await login(app, 'samira.test', 'samira12345', 'operator');
  assert.equal(session.status, 403);
  assert.equal(session.body.error.code, 'USER_DISABLED');

  await request(app)
    .patch(`/api/users/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isActive: true });
});

test('تغییر رمز عبور اپراتور توسط مدیر', async () => {
  const list = await request(app)
    .get('/api/users?q=samira')
    .set('Authorization', `Bearer ${adminToken}`);
  const id = list.body.items[0].id;

  const response = await request(app)
    .patch(`/api/users/${id}/password`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ newPassword: 'anotherPass123' });
  assert.equal(response.status, 200);

  const session = await login(app, 'samira.test', 'anotherPass123', 'operator');
  assert.equal(session.status, 200);
});

test('مدیر نمی‌تواند حساب خودش را غیرفعال یا حذف کند', async () => {
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);

  const disable = await request(app)
    .patch(`/api/users/${me.body.user.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isActive: false });
  assert.equal(disable.status, 400);

  const remove = await request(app)
    .delete(`/api/users/${me.body.user.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 400);
});

test('اپراتور جدید با نام کاربری حداقلی رد می‌شود', async () => {
  const response = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ...newOperator(), username: 'a b', nationalId: '0013542419' });

  assert.equal(response.status, 400);
});
