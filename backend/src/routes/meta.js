'use strict';

const express = require('express');
const { getDb } = require('../db');
const { asyncHandler } = require('../utils/http');
const { authRequired } = require('../middleware/auth');
const { WORK_TYPE_LABELS, STATUS_LABELS, FOLLOW_UP_LABELS } = require('../utils/serialize');
const { todayStr } = require('../utils/dates');

const router = express.Router();

router.use(authRequired);

router.get(
  '/zones',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const zones = await db.many('SELECT id, name FROM zones');
    const cities = await db.many('SELECT id, name, zone_id FROM cities');

    const zoneMap = new Map(
      zones
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          cities: [],
        }))
        .map((zone) => [zone.id, zone])
    );

    const orphanCities = [];
    for (const city of cities) {
      const zone = zoneMap.get(city.zone_id);
      const entry = { id: city.id, name: city.name, zoneId: city.zone_id };
      if (zone) zone.cities.push(entry);
      else orphanCities.push(entry);
    }

    const items = [...zoneMap.values()]
      .map((zone) => ({
        ...zone,
        cities: zone.cities.sort((a, b) => a.name.localeCompare(b.name, 'fa')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'));

    res.json({ items, citiesWithoutZone: orphanCities });
  })
);

router.get(
  '/lookups',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db.many(
      `SELECT cancel_reason, COUNT(*)::int AS total
       FROM loads
       WHERE status = 'cancelled'
       GROUP BY cancel_reason`
    );

    const cancelReasons = rows
      .filter((row) => row.cancel_reason && String(row.cancel_reason).trim() !== '')
      .map((row) => ({ value: row.cancel_reason, total: Number(row.total || 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    res.json({
      statuses: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      followUps: Object.entries(FOLLOW_UP_LABELS).map(([value, label]) => ({ value, label })),
      workTypes: Object.entries(WORK_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      cancelReasons,
      today: todayStr(),
    });
  })
);

module.exports = router;
