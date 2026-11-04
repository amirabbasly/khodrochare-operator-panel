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

test('اپراتور اجازه‌ی تغییر رمز خودش را ندارد', async () => {
  const { app } = await bootstrap();
  const token = await tokenFor(app, 'reza.asadi', 'operator12345', 'operator');
  const response = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'operator12345', newPassword: 'newPassword123' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('مدیر با رمز فعلی اشتباه نمی‌تواند رمز را عوض کند', async () => {
  const { app } = await bootstrap();
  const token = await tokenFor(app, 'admin', 'admin12345', 'admin');
  const response = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'nope-nope', newPassword: 'newPassword123' });

  assert.equal(response.status, 400);
});

test('تغییر رمز مدیر، نشست قبلی را باطل می‌کند و توکن تازه می‌دهد', async () => {
  const { app } = await bootstrap();
  const adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'مدیر',
      lastName: 'آزمایشی',
      username: 'sec.admin',
      password: 'SecAdmin2024x',
      role: 'admin',
    });

  const before = await login(app, 'sec.admin', 'SecAdmin2024x', 'admin');
  assert.equal(before.status, 200);

  const changed = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${before.body.token}`)
    .send({ currentPassword: 'SecAdmin2024x', newPassword: 'SecAdmin2025y' });

  assert.equal(changed.status, 200);
  assert.ok(changed.body.token);

  const stale = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${before.body.token}`);
  assert.equal(stale.status, 401);

  const fresh = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${changed.body.token}`);
  assert.equal(fresh.status, 200);
});

test('تغییر رمز اپراتور توسط مدیر، نشست فعال او را می‌بندد', async () => {
  const { app } = await bootstrap();
  const adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'کاربر',
      lastName: 'امنیتی',
      username: 'sec.operator',
      password: 'SecOperator2024x',
    });
  assert.equal(created.status, 201);

  const session = await login(app, 'sec.operator', 'SecOperator2024x', 'operator');
  assert.equal(session.status, 200);

  const reset = await request(app)
    .patch(`/api/users/${created.body.item.id}/password`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ newPassword: 'SecOperator2025y' });
  assert.equal(reset.status, 200);

  const stale = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${session.body.token}`);
  assert.equal(stale.status, 401);

  const relogin = await login(app, 'sec.operator', 'SecOperator2025y', 'operator');
  assert.equal(relogin.status, 200);
});

test('رمز ضعیف برای اپراتور پذیرفته نمی‌شود', async () => {
  const { app } = await bootstrap();
  const adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  const response = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'کاربر',
      lastName: 'ضعیف',
      username: 'weak.pass',
      password: '1234567890',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.details[0].field, 'password');
});

test('نام کاربری ناموجود و رمز اشتباه پیام یکسان می‌دهند (ضد افشای حساب)', async () => {
  const { app } = await bootstrap();
  const missing = await login(app, 'ghost.user', 'whatever12345', 'operator');
  const wrong = await login(app, 'admin', 'whatever12345', 'admin');

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(missing.body.error.message, wrong.body.error.message);
});

test('چند بار رمز اشتباه، حساب را موقتاً قفل می‌کند و مدیر می‌تواند قفل را بردارد', async () => {
  const { app } = await bootstrap();
  const adminToken = await tokenFor(app, 'admin', 'admin12345', 'admin');

  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      firstName: 'کاربر',
      lastName: 'قفل',
      username: 'lock.test',
      password: 'LockTest2024x',
    });
  assert.equal(created.status, 201);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await login(app, 'lock.test', 'WrongPass123', 'operator');
    assert.equal(failed.status, 401);
  }

  const locked = await login(app, 'lock.test', 'LockTest2024x', 'operator');
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');

  const unlock = await request(app)
    .patch(`/api/users/${created.body.item.id}/unlock`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(unlock.status, 200);

  const unlocked = await login(app, 'lock.test', 'LockTest2024x', 'operator');
  assert.equal(unlocked.status, 200);
});
