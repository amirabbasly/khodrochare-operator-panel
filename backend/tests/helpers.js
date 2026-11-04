'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'pgmem';
process.env.JWT_SECRET = 'test-secret-key';
process.env.AUTO_SEED = 'false';

const request = require('supertest');
const { createApp } = require('../src/app');
const { getDb, closeDb } = require('../src/db');
const { migrate } = require('../src/db/migrate');
const { seedDemo } = require('../src/db/seed-data');

let appInstance = null;
let dbInstance = null;

async function bootstrap() {
  if (appInstance) return { app: appInstance, db: dbInstance };

  dbInstance = await getDb();
  await migrate({ quiet: true });
  await seedDemo(dbInstance, { quiet: true });
  appInstance = createApp();
  return { app: appInstance, db: dbInstance };
}

async function login(app, username, password, role) {
  const response = await request(app).post('/api/auth/login').send({ username, password, role });
  return response;
}

async function tokenFor(app, username, password, role) {
  const response = await login(app, username, password, role);
  if (response.status !== 200) {
    throw new Error(`ورود ناموفق برای ${username}: ${response.status} ${response.body?.error?.message}`);
  }
  return response.body.token;
}

async function shutdown() {
  await closeDb();
  appInstance = null;
  dbInstance = null;
}

module.exports = { bootstrap, login, tokenFor, shutdown, request, getDb };
