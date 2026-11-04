'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');
const { getDb, closeDb, runSchema } = require('./index');
const { backfillSearchText } = require('../services/searchIndex');

/** اگر ستون وجود نداشت، آن را اضافه می‌کند (مهاجرت سازگار با نسخه‌های قبلی) */
async function ensureColumn(db, table, column, definition) {
  try {
    await db.query(`SELECT ${column} FROM ${table} LIMIT 1`);
    return false;
  } catch (error) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  }
}

/**
 * اجرای مهاجرت اسکیما + ساخت حساب مدیر پیش‌فرض (اگر هیچ کاربری وجود نداشته باشد)
 */
async function migrate({ quiet = false } = {}) {
  const db = await getDb();
  await runSchema(db);

  const addedLoadSearch = await ensureColumn(db, 'loads', 'search_text', 'TEXT');
  const addedRescuerSearch = await ensureColumn(db, 'rescuers', 'search_text', 'TEXT');
  if (addedLoadSearch || addedRescuerSearch) {
    const backfilled = await backfillSearchText(db, {
      tables: [
        ...(addedLoadSearch ? ['loads'] : []),
        ...(addedRescuerSearch ? ['rescuers'] : []),
      ],
    });
    if (!quiet) {
      console.log(
        `🔎 ایندکس جست‌وجو بازسازی شد (${backfilled.loads} بار، ${backfilled.rescuers} امدادگر).`
      );
    }
  }

  const userCount = Number(await db.scalar('SELECT COUNT(*)::int AS count FROM users'));
  let createdAdmin = false;

  if (userCount === 0) {
    const { username, password, firstName, lastName } = config.defaultAdmin;
    await db.query(
      `INSERT INTO users (first_name, last_name, username, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'admin', TRUE)`,
      [firstName, lastName, username, bcrypt.hashSync(password, 10)]
    );
    createdAdmin = true;
  }

  if (!quiet) {
    console.log('✅ مهاجرت پایگاه داده با موفقیت انجام شد.');
    if (createdAdmin) {
      console.log(`👤 حساب مدیر پیش‌فرض ساخته شد → نام کاربری: ${config.defaultAdmin.username}`);
      console.log(`🔑 رمز عبور پیش‌فرض: ${config.defaultAdmin.password}  (حتماً تغییر دهید)`);
    }
  }

  return { createdAdmin };
}

if (require.main === module) {
  migrate()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ خطا در مهاجرت پایگاه داده:', error.message);
      process.exit(1);
    });
}

module.exports = { migrate, ensureColumn };
