'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, login, tokenFor, shutdown, request } = require('./helpers');

test.before(async () => {
  await bootstrap();
});

test.after(async () => {
  await shutdown();
});

test('GET /api/health شماره وضعیت 200 برمی‌گرداند', async () => {
  const { app } = await bootstrap();
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('ورود با رمز اشتباه رد می‌شود', async () => {
  const { app } = await bootstrap();
  const response = await login(app, 'admin', 'wrong-password', 'admin');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
});

test('ورود با نقش نامطابق خطا می‌دهد', async () => {
  const { app } = await bootstrap();
  const response = await login(app, 'admin', 'admin12345', 'operator');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ROLE_MISMATCH');
});

test('ورود کاربر غیرفعال مسدود است', async () => {
  const { app } = await bootstrap();
  const response = await login(app, 'negar.hosseini', 'operator12345', 'operator');
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'USER_DISABLED');
});

test('ورود موفق مدیر توکن و اطلاعات کاربر می‌دهد', async () => {
  const { app } = await bootstrap();
  const response = await login(app, 'admin', 'admin12345', 'admin');
  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.role, 'admin');
  assert.equal(response.body.user.username, 'admin');
  assert.equal(response.body.user.password_hash, undefined);
});

test('ورود اپراتور بدون انتخاب نقش هم کار می‌کند', async () => {
  const { app } = await bootstrap();
  const response = await login(app, 'ali.rezaei', 'operator12345');
  assert.equal(response.status, 200);
  assert.equal(response.body.user.role, 'operator');
});

test('دسترسی بدون توکن به مسیرهای محافظت‌شده رد می‌شود', async () => {
  const { app } = await bootstrap();
  const response = await request(app).get('/api/loads');
  assert.equal(response.status, 401);
});

test('توکن نامعتبر رد می‌شود', async () => {
  const { app } = await bootstrap();
  const response = await request(app).get('/api/loads').set('Authorization', 'Bearer not-a-token');
  assert.equal(response.status, 401);
});

test('GET /api/auth/me اطلاعات کاربر جاری را برمی‌گرداند', async () => {
  const { app } = await bootstrap();
  const token = await tokenFor(app, 'admin', 'admin12345', 'admin');
  const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.user.username, 'admin');
});

test('تغییر رمز عبور با رمز فعلی اشتباه رد می‌شود', async () => {
  const { app } = await bootstrap();
  const token = await tokenFor(app, 'reza.asadi', 'operator12345', 'operator');
  const response = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'nope-nope', newPassword: 'newPassword123' });
  assert.equal(response.status, 400);
});

test('تغییر رمز عبور و ورود با رمز جدید', async () => {
  const { app } = await bootstrap();
  const token = await tokenFor(app, 'reza.asadi', 'operator12345', 'operator');
  const response = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'operator12345', newPassword: 'newPassword123' });
  assert.equal(response.status, 200);

  const relogin = await login(app, 'reza.asadi', 'newPassword123', 'operator');
  assert.equal(relogin.status, 200);

  // بازگرداندن رمز برای سایر تست‌ها
  await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${relogin.body.token}`)
    .send({ currentPassword: 'newPassword123', newPassword: 'operator12345' });
});
