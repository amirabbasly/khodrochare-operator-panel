'use strict';

const { ApiError } = require('../utils/http');

async function isDayClosed(db, date) {
  const row = await db.one('SELECT day FROM day_closures WHERE day = $1::date', [date]);
  return Boolean(row);
}

async function assertDayOpen(db, date) {
  if (await isDayClosed(db, date)) {
    throw ApiError.conflict(
      `روز ${date} بسته شده است و قابل ویرایش نیست. برای تغییر، ابتدا روز را از سر بگیرید.`,
      [{ field: 'loadDate', message: 'این روز بسته شده است.' }]
    );
  }
}

async function getDayClosure(db, date) {
  return db.one(
    `SELECT dc.day, dc.closed_at, dc.note, u.first_name || ' ' || u.last_name AS closed_by_name
     FROM day_closures dc
     LEFT JOIN users u ON u.id = dc.closed_by
     WHERE dc.day = $1::date`,
    [date]
  );
}

module.exports = { isDayClosed, assertDayOpen, getDayClosure };
