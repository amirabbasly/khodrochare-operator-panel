'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bootstrap, tokenFor, shutdown, request } = require('./helpers');
const config = require('../src/config');

const FAKE_IP = '203.0.113.77';

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

test('مشخصات حساب تله از مسیر عمومی برگردانده می‌شود', async () => {
  const response = await request(app).get('/api/auth/support-access');
  assert.equal(response.status, 200);
  assert.equal(response.body.username, config.decoy.username);
  assert.equal(response.body.password, config.decoy.password);
  assert.ok(response.body.username.length >= 4);
  assert.ok(response.body.password.length >= 8);
});

test('ورود با حساب تله، IP متقاضی را مسدود می‌کند', async () => {
  const attempt = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', FAKE_IP)
    .send({ username: config.decoy.username, password: config.decoy.password });

  assert.equal(attempt.status, 401);

  // پیام خطا نباید چیزی درباره‌ی تله لو بدهد
  assert.match(attempt.body.error.message, /نام کاربری یا رمز عبور اشتباه/);

  // همان IP دیگر به هیچ مسیر API دسترسی ندارد
  const blocked = await request(app)
    .get('/api/loads')
    .set('X-Forwarded-For', FAKE_IP)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'IP_BANNED');
});

test('مدیر فهرست IPهای مسدود را با جزئیات می‌بیند', async () => {
  const response = await request(app)
    .get('/api/security/bans')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  const item = response.body.items.find((entry) => entry.ip === FAKE_IP);
  assert.ok(item, 'IP مسدودشده باید در فهرست باشد');
  assert.equal(item.reason, 'decoy_credentials');
  assert.equal(item.username, config.decoy.username);
  assert.ok(item.attempts >= 1);
  assert.ok(response.body.summary.active >= 1);
});

test('رفع مسدودی IP از پنل مدیر', async () => {
  const response = await request(app)
    .delete(`/api/security/bans/${encodeURIComponent(FAKE_IP)}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(response.status, 200);

  const after = await request(app)
    .get('/api/loads')
    .set('X-Forwarded-For', FAKE_IP)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(after.status, 200);
});

test('اپراتور به بخش امنیت دسترسی ندارد', async () => {
  const response = await request(app)
    .get('/api/security/bans')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(response.status, 403);
});

test('مسدودسازی دستی IP توسط مدیر', async () => {
  const manualIp = '198.51.100.9';

  const created = await request(app)
    .post('/api/security/bans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ ip: manualIp });
  assert.equal(created.status, 201);

  const blocked = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', manualIp)
    .send({ username: 'admin', password: 'admin12345' });
  assert.equal(blocked.status, 403);

  const cleanup = await request(app)
    .delete(`/api/security/bans/${encodeURIComponent(manualIp)}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(cleanup.status, 200);
});
