'use strict';

/**
 * ایندکس جست‌وجوی متنی
 * برای جست‌وجوی ساده و سریع (و مستقل از فاصله/نیم‌فاصله)، همه‌ی فیلدهای متنی
 * در یک ستون search_text به‌صورت فشرده (بدون فاصله و با حروف کوچک) ذخیره می‌شوند.
 */

const SPACE_PATTERN = /[\s\u200c\u200d\u200e\u200f\u00a0]+/g;

/** یکسان‌سازی متن: حذف فاصله‌ها و نیم‌فاصله‌ها + حروف کوچک */
function compact(value) {
  return String(value == null ? '' : value)
    .replace(SPACE_PATTERN, '')
    .toLowerCase();
}

function buildSearchText(...parts) {
  const flat = parts.flat(3).filter((part) => part !== null && part !== undefined);
  return compact(flat.join(' '));
}

/**
 * توکن‌های جست‌وجو (هر کلمه یک شرط جداگانه است)
 * ورودی «محمودآباد امیر» → ['محمودآباد', 'امیر']
 */
function toSearchTokens(query) {
  return String(query || '')
    .split(/\s+/)
    .map((token) => compact(token))
    .filter((token) => token.length > 0)
    .slice(0, 6);
}

function resolveCityZoneNames(db, { cityId, zoneId }) {
  return (async () => {
    let cityName = null;
    let zoneName = null;
    let resolvedZoneId = zoneId ?? null;

    if (cityId) {
      const city = await db.one(
        'SELECT c.name AS city_name, z.name AS zone_name, c.zone_id FROM cities c LEFT JOIN zones z ON z.id = c.zone_id WHERE c.id = $1',
        [cityId]
      );
      if (city) {
        cityName = city.city_name;
        zoneName = city.zone_name;
        resolvedZoneId = zoneId ?? city.zone_id;
      }
    }

    if (!zoneName && resolvedZoneId) {
      const zone = await db.one('SELECT name FROM zones WHERE id = $1', [resolvedZoneId]);
      zoneName = zone?.name || null;
    }

    return { cityName, zoneName };
  })();
}

const LOAD_SEARCH_SOURCE = `
  SELECT l.customer_name, l.rescuer_name, l.vehicle_name, l.car_problem, l.address,
         l.description, l.customer_phone, c.name AS city_name, z.name AS zone_name
  FROM loads l
  LEFT JOIN cities c ON c.id = l.city_id
  LEFT JOIN zones z ON z.id = l.zone_id
  WHERE l.id = $1
`;

async function rebuildLoadSearchText(db, loadId) {
  const row = await db.one(LOAD_SEARCH_SOURCE, [loadId]);
  if (!row) return;
  const text = buildSearchText(
    row.customer_name,
    row.rescuer_name,
    row.vehicle_name,
    row.car_problem,
    row.address,
    row.description,
    row.customer_phone,
    row.city_name,
    row.zone_name
  );
  await db.query('UPDATE loads SET search_text = $1 WHERE id = $2', [text, loadId]);
}

const RESCUER_SEARCH_SOURCE = `
  SELECT r.first_name, r.last_name, r.phone, r.vehicle, r.plate,
         c.name AS city_name, z.name AS zone_name
  FROM rescuers r
  LEFT JOIN cities c ON c.id = r.city_id
  LEFT JOIN zones z ON z.id = r.zone_id
  WHERE r.id = $1
`;

async function rebuildRescuerSearchText(db, rescuerId) {
  const row = await db.one(RESCUER_SEARCH_SOURCE, [rescuerId]);
  if (!row) return;
  const text = buildSearchText(
    row.first_name,
    row.last_name,
    `${row.first_name || ''} ${row.last_name || ''}`,
    row.phone,
    row.vehicle,
    row.plate,
    row.city_name,
    row.zone_name
  );
  await db.query('UPDATE rescuers SET search_text = $1 WHERE id = $2', [text, rescuerId]);
}

/** بازسازی ایندکس جست‌وجو برای رکوردهای قدیمی (پس از مهاجرت) */
async function backfillSearchText(db, { tables = ['loads', 'rescuers'], limit = 2000 } = {}) {
  const summary = { loads: 0, rescuers: 0 };

  if (tables.includes('loads')) {
    const rows = await db.many(
      `SELECT id FROM loads WHERE search_text IS NULL OR search_text = '' LIMIT ${Number(limit)}`
    );
    for (const row of rows) {
      await rebuildLoadSearchText(db, row.id);
      summary.loads += 1;
    }
  }

  if (tables.includes('rescuers')) {
    const rows = await db.many(
      `SELECT id FROM rescuers WHERE search_text IS NULL OR search_text = '' LIMIT ${Number(limit)}`
    );
    for (const row of rows) {
      await rebuildRescuerSearchText(db, row.id);
      summary.rescuers += 1;
    }
  }

  return summary;
}

module.exports = {
  compact,
  buildSearchText,
  toSearchTokens,
  resolveCityZoneNames,
  rebuildLoadSearchText,
  rebuildRescuerSearchText,
  backfillSearchText,
};
