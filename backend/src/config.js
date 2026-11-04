'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

// فایل‌های .env ممکن است در ریشه‌ی پروژه یا پوشه‌ی backend باشند
// (dotenv مقادیر موجود را بازنویسی نمی‌کند، پس ترتیب اهمیت دارد)
for (const candidate of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
]) {
  if (fs.existsSync(candidate)) dotenv.config({ path: candidate });
}

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const DEFAULT_JWT_SECRET = 'change-me-in-production-khodrochare-crm-secret';

const config = {
  env,
  isProd,
  isTest: env === 'test',
  port: Number(process.env.PORT || 4000),
  timezone: process.env.APP_TIMEZONE || 'Asia/Tehran',

  jwt: {
    secret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  db: {
    // pg  → PostgreSQL واقعی (پیش‌فرض)   |   pgmem → حافظه‌ای برای دمو/تست
    driver: process.env.DB_DRIVER === 'pgmem' ? 'pgmem' : 'pg',
    connectionString: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'khodrochare',
    password: process.env.DB_PASSWORD || 'khodrochare',
    database: process.env.DB_NAME || 'khodrochare_crm',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    poolMax: Number(process.env.DB_POOL_MAX || 10),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // بذر داده‌ی نمایشی هنگام بالا آمدن سرویس (فقط برای دمو / محیط توسعه)
  autoSeed: process.env.AUTO_SEED === 'true' || process.env.DB_DRIVER === 'pgmem',

  defaultAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin12345',
    firstName: process.env.ADMIN_FIRST_NAME || 'مدیر',
    lastName: process.env.ADMIN_LAST_NAME || 'سیستم',
  },

  loginRateLimit: {
    windowMs: Number(process.env.LOGIN_WINDOW_MS || 10 * 60 * 1000),
    max: Number(process.env.LOGIN_MAX_ATTEMPTS || 30),
  },
};

if (isProd && config.jwt.secret === DEFAULT_JWT_SECRET) {
  throw new Error(
    'JWT_SECRET تعریف نشده است. برای محیط production باید یک کلید امن در متغیرهای محیطی تنظیم شود.'
  );
}

module.exports = config;
