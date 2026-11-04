'use strict';

const { getDb, closeDb, runSchema } = require('./index');
const { migrate } = require('./migrate');
const { seedDemo } = require('./seed-data');

async function main() {
  const force = process.argv.includes('--force');
  const db = await getDb();

  await runSchema(db);
  await migrate({ quiet: true });

  if (force) {
    console.log('🧹 پاک‌سازی داده‌های قبلی…');
    await db.query('DELETE FROM loads');
    await db.query('DELETE FROM day_closures');
    await db.query('DELETE FROM rescuers');
    await db.query('DELETE FROM cities');
    await db.query('DELETE FROM zones');
    await db.query("DELETE FROM users WHERE role = 'operator'");
  }

  const result = await seedDemo(db, { quiet: false });
  console.log(result.seeded ? '🎉 داده‌ی نمونه آماده است.' : 'ℹ️ داده‌ی نمونه از قبل موجود بود.');
  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('❌ خطا در ساخت داده‌ی نمونه:', error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
