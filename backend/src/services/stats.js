'use strict';

const { addDays, todayStr, monthOf } = require('../utils/dates');

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rate(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

const STATUS_SUM = `
  COUNT(*)::int AS total,
  SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
`;

/** نقشه‌های کمکی برای تبدیل شناسه‌ها به نام (مستقل از موتور پایگاه داده) */
async function loadLookups(db) {
  const [zones, cities, rescuers] = await Promise.all([
    db.many('SELECT id, name FROM zones'),
    db.many('SELECT id, name, zone_id FROM cities'),
    db.many('SELECT id, first_name, last_name, work_type, zone_id, city_id FROM rescuers'),
  ]);

  return {
    zones: new Map(zones.map((zone) => [Number(zone.id), zone.name])),
    cities: new Map(
      cities.map((city) => [Number(city.id), { name: city.name, zoneId: Number(city.zone_id) }])
    ),
    rescuers: new Map(rescuers.map((rescuer) => [Number(rescuer.id), rescuer])),
  };
}

async function loadTotals(db, from, to) {
  const row = await db.one(
    `SELECT ${STATUS_SUM},
            SUM(CASE WHEN follow_up = 'done' THEN 1 ELSE 0 END)::int AS follow_up_done,
            SUM(CASE WHEN follow_up = 'not_done' THEN 1 ELSE 0 END)::int AS follow_up_not_done
     FROM loads
     WHERE load_date BETWEEN $1::date AND $2::date`,
    [from, to]
  );

  return {
    loads: num(row?.total),
    confirmed: num(row?.confirmed),
    cancelled: num(row?.cancelled),
    pending: num(row?.pending),
    followUpDone: num(row?.follow_up_done),
    followUpNotDone: num(row?.follow_up_not_done),
  };
}

async function groupByZone(db, from, to, lookups) {
  const rows = await db.many(
    `SELECT zone_id, ${STATUS_SUM}
     FROM loads
     WHERE load_date BETWEEN $1::date AND $2::date
     GROUP BY zone_id`,
    [from, to]
  );

  // ردیف‌های بدون محدوده در گزارش‌های منطقه‌ای نمایش داده نمی‌شوند
  return rows
    .filter((row) => row.zone_id !== null && row.zone_id !== undefined)
    .map((row) => ({
      id: Number(row.zone_id),
      name: lookups.zones.get(Number(row.zone_id)) || 'نامشخص',
      total: num(row.total),
      confirmed: num(row.confirmed),
      cancelled: num(row.cancelled),
      pending: num(row.pending),
    }))
    .sort((a, b) => b.total - a.total);
}

async function groupByCity(db, from, to, lookups) {
  const rows = await db.many(
    `SELECT city_id, ${STATUS_SUM}
     FROM loads
     WHERE load_date BETWEEN $1::date AND $2::date
     GROUP BY city_id`,
    [from, to]
  );

  return rows
    .filter((row) => row.city_id !== null && row.city_id !== undefined)
    .map((row) => {
      const city = lookups.cities.get(Number(row.city_id));
      return {
        id: Number(row.city_id),
        name: city?.name || 'نامشخص',
        zoneName: city ? lookups.zones.get(city.zoneId) || null : null,
        total: num(row.total),
        confirmed: num(row.confirmed),
        cancelled: num(row.cancelled),
        pending: num(row.pending),
      };
    })
    .sort((a, b) => b.total - a.total);
}

async function groupByRescuer(db, from, to, lookups) {
  const rows = await db.many(
    `SELECT rescuer_id,
            COUNT(*)::int AS total,
            SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
     FROM loads
     WHERE load_date BETWEEN $1::date AND $2::date
     GROUP BY rescuer_id`,
    [from, to]
  );

  return rows
    .filter((row) => row.rescuer_id !== null && row.rescuer_id !== undefined)
    .map((row) => {
      const rescuer = lookups.rescuers.get(Number(row.rescuer_id));
      const city = rescuer ? lookups.cities.get(Number(rescuer.city_id)) : null;
      const total = num(row.total);
      return {
        id: Number(row.rescuer_id),
        fullName: rescuer ? `${rescuer.first_name} ${rescuer.last_name}`.trim() : 'نامشخص',
        workType: rescuer?.work_type || null,
        zoneName: rescuer ? lookups.zones.get(Number(rescuer.zone_id)) || null : null,
        cityName: city?.name || null,
        total,
        confirmed: num(row.confirmed),
        cancelled: num(row.cancelled),
        pending: num(row.pending),
        cancellationRate: rate(num(row.cancelled), total),
      };
    })
    .sort((a, b) => b.total - a.total);
}

async function cancelReasons(db, from, to) {
  const rows = await db.many(
    `SELECT cancel_reason, COUNT(*)::int AS total
     FROM loads
     WHERE status = 'cancelled'
       AND load_date BETWEEN $1::date AND $2::date
     GROUP BY cancel_reason`,
    [from, to]
  );

  return rows
    .map((row) => ({
      reason: row.cancel_reason || 'بدون دلیل ثبت‌شده',
      total: num(row.total),
    }))
    .sort((a, b) => b.total - a.total);
}

async function topProblems(db, from, to, limit = 8) {
  const rows = await db.many(
    `SELECT car_problem, COUNT(*)::int AS total
     FROM loads
     WHERE load_date BETWEEN $1::date AND $2::date
     GROUP BY car_problem`,
    [from, to]
  );

  return rows
    .map((row) => ({ problem: row.car_problem, total: num(row.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

async function dailyTrend(db, from, to) {
  const rows = await db.many(
    `SELECT load_date, ${STATUS_SUM}
     FROM loads
     WHERE load_date BETWEEN $1::date AND $2::date
     GROUP BY load_date`,
    [from, to]
  );

  const byDate = new Map(
    rows.map((row) => [
      String(row.load_date).slice(0, 10),
      {
        date: String(row.load_date).slice(0, 10),
        total: num(row.total),
        confirmed: num(row.confirmed),
        cancelled: num(row.cancelled),
        pending: num(row.pending),
      },
    ])
  );

  const series = [];
  let cursor = from;
  for (let guard = 0; guard < 400 && cursor <= to; guard += 1) {
    series.push(
      byDate.get(cursor) || { date: cursor, total: 0, confirmed: 0, cancelled: 0, pending: 0 }
    );
    cursor = addDays(cursor, 1);
  }
  return series;
}

async function monthlyTrend(db, from, to) {
  const series = await dailyTrend(db, from, to);
  const months = new Map();

  for (const day of series) {
    const key = monthOf(day.date);
    const bucket = months.get(key) || {
      month: key,
      total: 0,
      confirmed: 0,
      cancelled: 0,
      pending: 0,
    };
    bucket.total += day.total;
    bucket.confirmed += day.confirmed;
    bucket.cancelled += day.cancelled;
    bucket.pending += day.pending;
    months.set(key, bucket);
  }

  return [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}

async function counts(db) {
  const [rescuerRow, operatorRow, loadRow, adminRow] = await Promise.all([
    db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active,
              SUM(CASE WHEN work_type = 'garage' THEN 1 ELSE 0 END)::int AS garages
       FROM rescuers`
    ),
    db.one(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active
       FROM users WHERE role = 'operator'`
    ),
    db.one('SELECT COUNT(*)::int AS total FROM loads'),
    db.one("SELECT COUNT(*)::int AS total FROM users WHERE role = 'admin'"),
  ]);

  return {
    rescuers: {
      total: num(rescuerRow?.total),
      active: num(rescuerRow?.active),
      garages: num(rescuerRow?.garages),
    },
    operators: { total: num(operatorRow?.total), active: num(operatorRow?.active) },
    admins: num(adminRow?.total),
    allLoads: num(loadRow?.total),
  };
}

async function rescuersByWorkType(db, from, to) {
  const [rescuerRows, loadRows] = await Promise.all([
    db.many('SELECT work_type, COUNT(*)::int AS total FROM rescuers GROUP BY work_type'),
    db.many(
      `SELECT r.work_type, COUNT(l.id)::int AS total
       FROM loads l
       JOIN rescuers r ON r.id = l.rescuer_id
       WHERE l.load_date BETWEEN $1::date AND $2::date
       GROUP BY r.work_type`,
      [from, to]
    ),
  ]);

  const loadMap = new Map(loadRows.map((row) => [row.work_type, num(row.total)]));
  return rescuerRows.map((row) => ({
    workType: row.work_type,
    rescuers: num(row.total),
    loads: loadMap.get(row.work_type) || 0,
  }));
}

async function operatorPerformance(db, from, to) {
  const [operatorRows, loadRows] = await Promise.all([
    db.many('SELECT id, first_name, last_name, username, is_active FROM users WHERE role = $1', [
      'operator',
    ]),
    db.many(
      `SELECT created_by,
              COUNT(*)::int AS total,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
       FROM loads
       WHERE load_date BETWEEN $1::date AND $2::date
       GROUP BY created_by`,
      [from, to]
    ),
  ]);

  const statsMap = new Map(
    loadRows
      .filter((row) => row.created_by !== null && row.created_by !== undefined)
      .map((row) => [Number(row.created_by), row])
  );

  return operatorRows
    .map((operator) => {
      const stats = statsMap.get(Number(operator.id)) || {};
      const total = num(stats.total);
      return {
        id: operator.id,
        fullName: `${operator.first_name} ${operator.last_name}`.trim(),
        username: operator.username,
        isActive: Boolean(operator.is_active),
        total,
        confirmed: num(stats.confirmed),
        cancelled: num(stats.cancelled),
        pending: num(stats.pending),
        confirmationRate: rate(num(stats.confirmed), total),
      };
    })
    .sort((a, b) => b.total - a.total);
}

async function buildOverview(db, { from, to }) {
  const today = todayStr();
  const lookups = await loadLookups(db);

  const [
    totals,
    zoneRows,
    cityRows,
    rescuerRows,
    reasons,
    problems,
    trend,
    countsRow,
    workTypes,
    todayTotals,
  ] = await Promise.all([
    loadTotals(db, from, to),
    groupByZone(db, from, to, lookups),
    groupByCity(db, from, to, lookups),
    groupByRescuer(db, from, to, lookups),
    cancelReasons(db, from, to),
    topProblems(db, from, to),
    dailyTrend(db, from, to),
    counts(db),
    rescuersByWorkType(db, from, to),
    loadTotals(db, today, today),
  ]);

  const byConfirmed = [...rescuerRows].sort((a, b) => b.confirmed - a.confirmed).slice(0, 6);
  const byCancelled = [...rescuerRows].sort((a, b) => b.cancelled - a.cancelled).slice(0, 6);

  return {
    range: { from, to },
    totals: {
      ...totals,
      confirmationRate: rate(totals.confirmed, totals.loads),
      cancellationRate: rate(totals.cancelled, totals.loads),
      pendingRate: rate(totals.pending, totals.loads),
    },
    today: {
      date: today,
      total: todayTotals.loads,
      confirmed: todayTotals.confirmed,
      cancelled: todayTotals.cancelled,
      pending: todayTotals.pending,
    },
    counts: countsRow,
    zones: zoneRows,
    cities: cityRows,
    rescuers: rescuerRows,
    topRescuers: { confirmed: byConfirmed, cancelled: byCancelled },
    cancelReasons: reasons,
    problems,
    trend,
    workTypes,
  };
}

async function buildDetailed(db, { from, to }) {
  const overview = await buildOverview(db, { from, to });
  const [operators, months] = await Promise.all([
    operatorPerformance(db, from, to),
    monthlyTrend(db, from, to),
  ]);

  return { ...overview, operators, monthlyTrend: months };
}

module.exports = {
  buildOverview,
  buildDetailed,
  operatorPerformance,
  loadTotals,
  loadLookups,
  groupByZone,
  groupByCity,
  groupByRescuer,
  cancelReasons,
  dailyTrend,
  monthlyTrend,
  counts,
};
