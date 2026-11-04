'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { types } = require('pg');
const config = require('../config');
const { toDateStr } = require('../utils/dates');

// نگه‌داشتن ستون DATE به‌صورت رشته‌ی YYYY-MM-DD (بدون جابه‌جایی منطقه‌ی زمانی)
types.setTypeParser(1082, (value) => value);

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function isDateKey(key) {
  return key === 'day' || key.endsWith('date') || key.endsWith('_at_date');
}

function normalizeValue(key, value) {
  if (value instanceof Date) {
    return isDateKey(key) ? toDateStr(value) : value.toISOString();
  }
  return value;
}

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) out[key] = normalizeValue(key, value);
  return out;
}

/** پاک‌سازی و تفکیک دستورات SQL از فایل schema */
function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean);
}

class Db {
  constructor(pool, driver) {
    this.pool = pool;
    this.driver = driver;
  }

  async query(text, params = []) {
    const result = await this.pool.query(text, params);
    const rows = (result.rows || []).map(normalizeRow);
    return { rows, rowCount: typeof result.rowCount === 'number' ? result.rowCount : rows.length };
  }

  async many(text, params = []) {
    return (await this.query(text, params)).rows;
  }

  async one(text, params = []) {
    const { rows } = await this.query(text, params);
    return rows[0] || null;
  }

  async scalar(text, params = []) {
    const row = await this.one(text, params);
    if (!row) return null;
    return row[Object.keys(row)[0]];
  }

  async exec(text) {
    return this.pool.query(text);
  }

  async close() {
    if (this.pool.end) await this.pool.end();
  }
}

async function runSchema(db) {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  for (const statement of splitStatements(sql)) {
    try {
      await db.exec(statement);
    } catch (error) {
      // ایندکس‌های اختیاری در موتور حافظه‌ای ممکن است پشتیبانی نشوند
      if (/^CREATE INDEX/i.test(statement)) continue;
      throw error;
    }
  }
}

function createPgPool() {
  const { Pool } = require('pg');
  const { db } = config;
  const poolOptions = db.connectionString
    ? { connectionString: db.connectionString, ssl: db.ssl }
    : {
        host: db.host,
        port: db.port,
        user: db.user,
        password: db.password,
        database: db.database,
        ssl: db.ssl,
      };
  return new Pool({ ...poolOptions, max: db.poolMax });
}

async function createPgmemPool() {
  // فقط برای دمو/تست بدون PostgreSQL — در production استفاده نمی‌شود
  const { newDb } = require('pg-mem');
  const memory = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const { Pool } = memory.adapters.createPg();
  return new Pool();
}

let dbPromise = null;

async function getDb({ ready = true } = {}) {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (config.db.driver === 'pgmem') {
        const pool = await createPgmemPool();
        const db = new Db(pool, 'pgmem');
        await runSchema(db);
        return db;
      }
      const db = new Db(createPgPool(), 'pg');
      if (ready) await db.query('SELECT 1');
      return db;
    })();
  }
  return dbPromise;
}

async function resetDbForTests() {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    if (db) await db.close().catch(() => {});
  }
  dbPromise = null;
}

async function closeDb() {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    if (db) await db.close().catch(() => {});
    dbPromise = null;
  }
}

module.exports = {
  Db,
  getDb,
  closeDb,
  resetDbForTests,
  runSchema,
  splitStatements,
  SCHEMA_PATH,
};
