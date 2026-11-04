'use strict';

const { ApiError } = require('./http');

/**
 * اپراتور، شهر و محدوده را خودش تایپ می‌کند (نه انتخاب از لیست).
 * این ماژول نام‌های تایپ‌شده را به رکوردهای zones / cities تبدیل می‌کند تا
 * آمارگیری بر اساس منطقه همچنان دقیق بماند.
 */

function cleanName(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, 80) : null;
}

const UNKNOWN_ZONE = 'نامشخص';

async function findOrCreateZone(db, rawName) {
  const name = cleanName(rawName);
  if (!name) return null;

  const existing = await db.one('SELECT id FROM zones WHERE name = $1', [name]);
  if (existing) return existing.id;

  try {
    const created = await db.one('INSERT INTO zones (name) VALUES ($1) RETURNING id', [name]);
    return created.id;
  } catch (error) {
    const again = await db.one('SELECT id FROM zones WHERE name = $1', [name]);
    if (again) return again.id;
    throw error;
  }
}

async function findOrCreateCity(db, { name, zoneId }) {
  const cityName = cleanName(name);
  if (!cityName) return null;

  const existing = await db.one('SELECT id, zone_id FROM cities WHERE name = $1', [cityName]);
  if (existing) return { cityId: existing.id, zoneId: existing.zone_id };

  const resolvedZoneId = zoneId || (await findOrCreateZone(db, UNKNOWN_ZONE));

  try {
    const created = await db.one(
      'INSERT INTO cities (name, zone_id) VALUES ($1, $2) RETURNING id, zone_id',
      [cityName, resolvedZoneId]
    );
    return { cityId: created.id, zoneId: created.zone_id };
  } catch (error) {
    const again = await db.one('SELECT id, zone_id FROM cities WHERE name = $1', [cityName]);
    if (again) return { cityId: again.id, zoneId: again.zone_id };
    throw error;
  }
}

/**
 * شناسه‌ی نهایی شهر/محدوده را از ترکیب (شناسه‌ها | نام‌های تایپ‌شده) می‌سازد.
 */
async function resolveLocation(db, { zoneId = null, cityId = null, zoneName = null, cityName = null } = {}) {
  let resolvedZoneId = zoneId ?? null;
  let resolvedCityId = cityId ?? null;

  if (resolvedCityId) {
    const city = await db.one('SELECT id, zone_id FROM cities WHERE id = $1', [resolvedCityId]);
    if (!city) {
      throw ApiError.badRequest('شهر انتخاب‌شده معتبر نیست.', [
        { field: 'cityId', message: 'شهر یافت نشد.' },
      ]);
    }
    return { cityId: resolvedCityId, zoneId: resolvedZoneId ?? city.zone_id };
  }

  if (zoneName) {
    const zone = await findOrCreateZone(db, zoneName);
    if (zone) resolvedZoneId = zone;
  }

  if (cityName) {
    const city = await findOrCreateCity(db, { name: cityName, zoneId: resolvedZoneId });
    if (city) {
      resolvedCityId = city.cityId;
      resolvedZoneId = city.zoneId ?? resolvedZoneId;
    }
  }

  if (resolvedZoneId) {
    const zone = await db.one('SELECT id FROM zones WHERE id = $1', [resolvedZoneId]);
    if (!zone) {
      throw ApiError.badRequest('محدوده انتخاب‌شده معتبر نیست.', [
        { field: 'zoneId', message: 'محدوده یافت نشد.' },
      ]);
    }
  }

  return { cityId: resolvedCityId, zoneId: resolvedZoneId };
}

module.exports = { cleanName, findOrCreateZone, findOrCreateCity, resolveLocation, UNKNOWN_ZONE };
