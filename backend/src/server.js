'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { getDb, closeDb } = require('./db');
const { migrate } = require('./db/migrate');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** انتظار برای آماده‌شدن PostgreSQL (مفید در docker compose) */
async function waitForDatabase(attempts = 20, delayMs = 2000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const db = await getDb();
      await db.query('SELECT 1');
      return db;
    } catch (error) {
      console.warn(`⏳ تلاش ${attempt}/${attempts} برای اتصال به پایگاه داده ناموفق بود: ${error.message}`);
      if (attempt === attempts) throw error;
      await sleep(delayMs);
    }
  }
  throw new Error('اتصال به پایگاه داده برقرار نشد.');
}

async function bootstrap() {
  const db = await waitForDatabase();

  if (config.db.driver === 'pg' && process.env.MIGRATE_ON_START !== 'false') {
    await migrate({ quiet: true });
  }

  if (config.autoSeed) {
    const { seedDemo } = require('./db/seed-data');
    console.log('🌱 در حال ساخت داده‌ی نمونه…');
    await seedDemo(db, { quiet: false });
  }

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log('');
    console.log('🚗  Khodrochare CRM API');
    console.log(`    ▸ آدرس:        http://localhost:${config.port}/api`);
    console.log(`    ▸ سلامت:       http://localhost:${config.port}/api/health`);
    console.log(`    ▸ درایور DB:   ${config.db.driver}`);
    console.log(`    ▸ منطقه زمانی: ${config.timezone}`);
    console.log('');
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} دریافت شد؛ خاموش شدن سرویس…`);
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('❌ راه‌اندازی سرویس با خطا مواجه شد:', error);
    process.exit(1);
  });
}

module.exports = { bootstrap };
