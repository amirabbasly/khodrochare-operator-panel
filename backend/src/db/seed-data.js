'use strict';

const { hashPassword } = require('../services/passwords');
const { addDays, todayStr } = require('../utils/dates');
const { generateNationalId } = require('../utils/nationalId');
const { buildSearchText } = require('../services/searchIndex');

const ZONES = [
  { name: 'غرب مازندران', cities: ['چالوس', 'نوشهر', 'کلاردشت', 'عباس‌آباد', 'تنکابن'] },
  { name: 'مرکز مازندران', cities: ['آمل', 'بابل', 'محمودآباد', 'فریدونکنار', 'نور', 'بابلسر'] },
  { name: 'شرق مازندران', cities: ['ساری', 'نکا', 'بهشهر', 'گلوگاه', 'میاندرود'] },
  { name: 'تهران', cities: ['تهران', 'شهریار', 'اسلامشهر', 'رباط‌کریم', 'پاکدشت'] },
  { name: 'البرز', cities: ['کرج', 'فردیس', 'نظرآباد', 'اشتهارد'] },
  { name: 'گیلان', cities: ['رشت', 'لاهیجان', 'بندرانزلی', 'آستارا', 'تالش'] },
  { name: 'اصفهان', cities: ['اصفهان', 'کاشان', 'نجف‌آباد', 'خمینی‌شهر'] },
  { name: 'فارس', cities: ['شیراز', 'مرودشت', 'کازرون', 'لار'] },
  { name: 'خراسان رضوی', cities: ['مشهد', 'نیشابور', 'سبزوار', 'تربت حیدریه'] },
  { name: 'آذربایجان شرقی', cities: ['تبریز', 'مراغه', 'مرند', 'اهر'] },
];

const OPERATORS = [
  { firstName: 'علی', lastName: 'رضایی', username: 'ali.rezaei', phone: '09121110001', password: 'operator12345' },
  { firstName: 'سارا', lastName: 'محمدی', username: 'sara.mohammadi', phone: '09121110002', password: 'operator12345' },
  { firstName: 'رضا', lastName: 'اسدی', username: 'reza.asadi', phone: '09121110003', password: 'operator12345' },
  { firstName: 'نگار', lastName: 'حسینی', username: 'negar.hosseini', phone: '09121110004', password: 'operator12345' },
];

const RESCUERS = [
  { firstName: 'امیر', lastName: 'کریمی', zone: 'مرکز مازندران', city: 'محمودآباد', vehicle: 'نیسان زامیاد', plate: '۱۲ب۳۴۵-۷۳', workType: 'transport', phone: '09111234501' },
  { firstName: 'حمید', lastName: 'رستمی', zone: 'مرکز مازندران', city: 'نور', vehicle: 'تویوتا هایلوکس', plate: '۴۵ج۷۸۹-۷۳', workType: 'both', phone: '09111234502' },
  { firstName: 'مهدی', lastName: 'صادقی', zone: 'غرب مازندران', city: 'چالوس', vehicle: 'پیکان وانت', plate: '۳۳د۲۱۱-۷۳', workType: 'garage', phone: '09111234503' },
  { firstName: 'سعید', lastName: 'نوری', zone: 'غرب مازندران', city: 'نوشهر', vehicle: 'سوزوکی وانت', plate: '۶۷س۴۵۱-۷۳', workType: 'onsite_repair', phone: '09111234504' },
  { firstName: 'یاسر', lastName: 'قربانی', zone: 'مرکز مازندران', city: 'آمل', vehicle: 'کامیونت ایسوزو', plate: '۲۲م۹۸۷-۷۳', workType: 'transport', phone: '09111234505' },
  { firstName: 'حسین', lastName: 'اکبری', zone: 'مرکز مازندران', city: 'بابل', vehicle: 'وانت زامیاد', plate: '۸۹ب۶۵۴-۷۳', workType: 'both', phone: '09111234506' },
  { firstName: 'مصطفی', lastName: 'رجبی', zone: 'شرق مازندران', city: 'ساری', vehicle: 'نیسان تک سوز', plate: '۵۶ط۱۲۳-۷۳', workType: 'garage', phone: '09111234507' },
  { firstName: 'رحیم', lastName: 'دلاور', zone: 'شرق مازندران', city: 'نکا', vehicle: 'پیکان وانت', plate: '۱۹ر۸۷۶-۷۳', workType: 'onsite_repair', phone: '09111234508' },
  { firstName: 'ابراهیم', lastName: 'کاظمی', zone: 'شرق مازندران', city: 'بهشهر', vehicle: 'وانت زامیاد', plate: '۴۴ک۳۲۱-۷۳', workType: 'transport', phone: '09111234509' },
  { firstName: 'فرزاد', lastName: 'مرادی', zone: 'تهران', city: 'تهران', vehicle: 'نیسان زامیاد', plate: '۷۷ب۹۹۱-۱۱', workType: 'both', phone: '09121234510' },
  { firstName: 'نوید', lastName: 'زمانی', zone: 'تهران', city: 'تهران', vehicle: 'ایویکو دیلی', plate: '۲۵ج۴۴۳-۱۱', workType: 'garage', phone: '09121234511' },
  { firstName: 'آرمان', lastName: 'شفیعی', zone: 'البرز', city: 'کرج', vehicle: 'سوزوکی وانت', plate: '۶۳د۱۲۸-۶۸', workType: 'onsite_repair', phone: '09121234512' },
  { firstName: 'کیوان', lastName: 'امیدی', zone: 'گیلان', city: 'رشت', vehicle: 'نیسان Z24', plate: '۸۱س۷۷۲-۴۶', workType: 'transport', phone: '09111234513' },
  { firstName: 'بهروز', lastName: 'گلستانی', zone: 'گیلان', city: 'لاهیجان', vehicle: 'وانت زامیاد', plate: '۳۸م۵۱۹-۴۶', workType: 'both', phone: '09111234514' },
  { firstName: 'مسعود', lastName: 'جعفری', zone: 'اصفهان', city: 'اصفهان', vehicle: 'ایویکو دیلی', plate: '۵۲ط۶۶۴-۱۳', workType: 'garage', phone: '09131234515' },
  { firstName: 'علی', lastName: 'محمودی', zone: 'خراسان رضوی', city: 'مشهد', vehicle: 'نیسان زامیاد', plate: '۹۲ب۷۳۵-۹۹', workType: 'both', phone: '09151234516' },
  { firstName: 'سجاد', lastName: 'نبوی', zone: 'فارس', city: 'شیراز', vehicle: 'پیکان وانت', plate: '۲۷ک۸۸۱-۶۳', workType: 'onsite_repair', phone: '09171234517' },
  { firstName: 'وحید', lastName: 'علوی', zone: 'آذربایجان شرقی', city: 'تبریز', vehicle: 'کامیونت ایسوزو', plate: '۶۱د۴۱۲-۲۵', workType: 'transport', phone: '09141234518' },
];

const CUSTOMERS = [
  'محمود رضایی', 'زهرا احمدی', 'حسین کریمی', 'مریم موسوی', 'سعید قاسمی',
  'فاطمه شریفی', 'عباس فارسی', 'نرگس عباسی', 'امیرحسین طاهری', 'شبنم کاظمی',
  'جواد نعمتی', 'الهام صفری', 'بابک خسروی', 'پریسا اکبری', 'کامران نجفی',
  'سمیرا بیات', 'میلاد صالحی', 'فرشته یوسفی', 'یوسف رحیمی', 'لیلا فتحی',
];

const VEHICLES = [
  'پژو ۲۰۶', 'سمند LX', 'پراید ۱۳۱', 'دنا پلاس', 'تارا', 'شاهین', 'تیبا ۲',
  'پژو پارس', 'رانا پلاس', 'هایما S7', 'کوییک', 'ساینا', 'فیدلیتی', 'جک S5',
  'رنو تندر ۹۰', 'کیا سراتو', 'مزدا ۳', 'ون تیبو',
];

const PROBLEMS = [
  'روشن نشدن خودرو', 'خاموش شدن ناگهانی', 'باتری خوابیده', 'پنچری لاستیک',
  'داغ کردن موتور', 'خرابی دینام', 'نشت روغن', 'مشکل سیستم برقی',
  'خرابی جعبه‌دنده', 'تصادف و نیاز به حمل', 'شکستگی شیشه', 'خرابی ترمز',
  'قفل شدن فرمان', 'ترکیدن لاستیک',
];

const AMOUNTS = [350000, 500000, 650000, 800000, 1000000, 1200000, 1500000, 1800000, 2000000, 2500000];

const LOAD_TYPE_POOL = [
  { value: 'transport', weight: 45 },
  { value: 'onsite_repair', weight: 35 },
  { value: 'garage_dispatch', weight: 20 },
];

/** اطلاعات مالی نمونه: مبلغ، نوع بار، درصد و سهم امدادگر، وضعیت پرداخت */
function buildMoney(random) {
  const amount = pick(random, AMOUNTS);
  const loadType = pickWeighted(random, LOAD_TYPE_POOL);
  const rate = loadType === 'transport' ? 20 : 30;
  const commission = Math.round((amount * rate) / 100);
  const isPaid = random() > 0.45;
  return {
    amount,
    loadType,
    rate,
    commission,
    isPaid,
    garageDispatched: loadType === 'garage_dispatch' ? random() > 0.5 : false,
  };
}

const CANCEL_REASONS = [
  'لغو توسط امدادخواه',
  'عدم حضور امدادگر در زمان مقرر',
  'خارج از محدوده‌ی پوشش',
  'تکرار درخواست',
  'ارجاع به امدادگر دیگر',
  'نبود امدادگر آزاد در محدوده',
  'اشتباه در ثبت اطلاعات',
  'اتمام ساعت کاری امدادگر',
];

const ADDRESSES = [
  'کیلومتر ۱۲ جاده‌ی اصلی، روبه‌روی پمپ بنزین',
  'بلوار امام، نبش کوچه‌ی شهید احمدی',
  'جاده‌ی ساحلی، بعد از پل، پلاک ۴۵',
  'اتوبان، خروجی صنایع، پارکینگ مجتمع',
  'خیابان شهید بهشتی، کوچه‌ی گلستان، پلاک ۸',
  'روستای بالا محله، ابتدای جاده‌ی خاکی',
];

function createRandom(seed = 20260101) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function pickWeighted(random, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = random() * total;
  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

async function ensureAdmin(db) {
  const existing = await db.one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing) return existing.id;

  const inserted = await db.one(
    `INSERT INTO users (first_name, last_name, username, password_hash, phone, national_id, role)
     VALUES ('مدیر', 'سیستم', 'admin', $1, '02133445566', '0012345679', 'admin') RETURNING id`,
    [hashPassword('admin12345')]
  );
  return inserted.id;
}

async function seedDemo(db, { loadsCount = 240, days = 24, quiet = false, random: randomSeed = 20260101 } = {}) {
  const random = createRandom(randomSeed);
  const log = (...args) => {
    if (!quiet) console.log(...args);
  };

  const adminId = await ensureAdmin(db);

  // ---- اپراتورها ----
  const operatorIds = [];
  for (const operator of OPERATORS) {
    const existing = await db.one('SELECT id FROM users WHERE username = $1', [operator.username]);
    if (existing) {
      operatorIds.push(existing.id);
      continue;
    }
    const created = await db.one(
      `INSERT INTO users (first_name, last_name, username, password_hash, phone, national_id, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'operator') RETURNING id`,
      [
        operator.firstName,
        operator.lastName,
        operator.username,
        hashPassword(operator.password),
        operator.phone,
        generateNationalId(random),
      ]
    );
    operatorIds.push(created.id);
  }
  // اپراتور چهارم برای نمایش حالت غیرفعال
  await db.query("UPDATE users SET is_active = FALSE WHERE username = 'negar.hosseini'");

  // ---- محدوده‌ها و شهرها ----
  const zoneIds = new Map();
  const cityIds = new Map();
  const cityZone = new Map();

  for (const zone of ZONES) {
    let row = await db.one('SELECT id FROM zones WHERE name = $1', [zone.name]);
    if (!row) {
      row = await db.one('INSERT INTO zones (name) VALUES ($1) RETURNING id', [zone.name]);
    }
    zoneIds.set(zone.name, row.id);

    for (const city of zone.cities) {
      let cityRow = await db.one('SELECT id FROM cities WHERE name = $1', [city]);
      if (!cityRow) {
        cityRow = await db.one(
          'INSERT INTO cities (name, zone_id) VALUES ($1, $2) RETURNING id',
          [city, row.id]
        );
      }
      cityIds.set(city, cityRow.id);
      cityZone.set(city, { zoneId: row.id, zoneName: zone.name });
    }
  }

  // ---- امدادگران ----
  const rescuerRows = await db.many('SELECT id, first_name, last_name, city_id, zone_id FROM rescuers');
  const rescuerList = [];

  if (rescuerRows.length === 0) {
    for (const rescuer of RESCUERS) {
      const zoneId = zoneIds.get(rescuer.zone);
      const cityId = cityIds.get(rescuer.city);
      const created = await db.one(
        `INSERT INTO rescuers
           (first_name, last_name, phone, vehicle, plate, zone_id, city_id, work_type,
            is_active, notes, search_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
         RETURNING id, first_name, last_name, city_id, zone_id`,
        [
          rescuer.firstName,
          rescuer.lastName,
          rescuer.phone,
          rescuer.vehicle,
          rescuer.plate,
          zoneId,
          cityId,
          rescuer.workType,
          rescuer.workType === 'garage' ? 'تعمیرگاه مجاز — امتیاز ویژه' : null,
          buildSearchText(
            rescuer.firstName,
            rescuer.lastName,
            `${rescuer.firstName} ${rescuer.lastName}`,
            rescuer.phone,
            rescuer.vehicle,
            rescuer.plate,
            rescuer.city,
            rescuer.zone
          ),
        ]
      );
      rescuerList.push(created);
    }
    log(`👷 ${rescuerList.length} امدادگر ثبت شد.`);
  } else {
    rescuerRows.forEach((row) => rescuerList.push(row));
  }

  // ---- بارها ----
  const existingLoads = Number(await db.scalar('SELECT COUNT(*)::int AS count FROM loads'));
  if (existingLoads > 0) {
    log('ℹ️ داده‌ی بارها از قبل موجود است؛ از تولید مجدد صرف‌نظر شد.');
    return { seeded: false };
  }

  const today = todayStr();
  const statusPool = [
    { value: 'confirmed', weight: 58 },
    { value: 'cancelled', weight: 18 },
    { value: 'pending', weight: 24 },
  ];

  const allCities = [...cityIds.keys()];
  const rows = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = addDays(today, -dayOffset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // ۰ = یکشنبه
    const isWeekendPeak = weekday === 4 || weekday === 5; // پنجشنبه/جمعه
    const base = isWeekendPeak ? 14 : 8;
    const dailyCount = Math.max(3, Math.round(base + (random() - 0.5) * 6));

    for (let i = 0; i < dailyCount; i += 1) {
      const city = pickWeighted(
        random,
        allCities.map((name) => ({
          value: name,
          weight:
            name === 'محمودآباد' || name === 'بابل' || name === 'آمل'
              ? 4
              : name === 'تهران' || name === 'ساری'
                ? 3
                : 1,
        }))
      );
      const zone = cityZone.get(city);
      const status = pickWeighted(random, statusPool);

      const rescuerCandidates = rescuerList.filter((r) => Number(r.city_id) === Number(cityIds.get(city)));
      const fallbackCandidates = rescuerList.filter((r) => Number(r.zone_id) === Number(zone.zoneId));
      const rescuer =
        status === 'pending'
          ? null
          : pick(random, rescuerCandidates.length ? rescuerCandidates : fallbackCandidates.length ? fallbackCandidates : rescuerList);

      const followUp = status === 'pending' ? 'not_done' : random() > 0.35 ? 'done' : 'not_done';

      const vehicle = pick(random, VEHICLES);
      const problem = pick(random, PROBLEMS);
      const customer = pick(random, CUSTOMERS);
      const address = `${pick(random, ADDRESSES)} — ${city}`;
      const description = random() > 0.6 ? 'امدادخواه درخواست فوریت داشت.' : null;
      const phone = `09${Math.floor(random() * 9) + 1}${String(Math.floor(random() * 10000000)).padStart(7, '0')}`;
      const rescuerFullName = rescuer ? `${rescuer.first_name} ${rescuer.last_name}` : null;
      const money = buildMoney(random);

      rows.push([
        date,
        vehicle,
        phone,
        problem,
        customer,
        rescuer ? rescuer.id : null,
        rescuerFullName,
        address,
        description,
        zone.zoneId,
        cityIds.get(city),
        status,
        status === 'cancelled' ? pick(random, CANCEL_REASONS) : null,
        followUp,
        pick(random, operatorIds),
        buildSearchText(
          customer,
          rescuerFullName,
          vehicle,
          problem,
          address,
          description,
          phone,
          city,
          zone.zoneName
        ),
        money.amount,
        money.loadType,
        money.garageDispatched,
        money.rate,
        money.commission,
        money.isPaid,
        money.isPaid ? `${date} 12:00:00` : null,
        money.isPaid ? adminId : null,
        money.isPaid ? money.commission : null,
      ]);
    }
  }

  // محموله‌های امروز تضمینی برای نمایش داشبورد
  for (let i = 0; i < 4; i += 1) {
    const city = pick(random, ['محمودآباد', 'بابل', 'آمل', 'چالوس', 'تهران']);
    const zone = cityZone.get(city);
    const rescuer = pick(random, rescuerList);
    const vehicle = pick(random, VEHICLES);
    const problem = pick(random, PROBLEMS);
    const customer = pick(random, CUSTOMERS);
    const address = `${pick(random, ADDRESSES)} — ${city}`;
    const phone = `0912${String(Math.floor(random() * 10000000)).padStart(7, '0')}`;
    const rescuerFullName = `${rescuer.first_name} ${rescuer.last_name}`;
    const money = buildMoney(random);

    rows.push([
      today,
      vehicle,
      phone,
      problem,
      customer,
      rescuer.id,
      rescuerFullName,
      address,
      null,
      zone.zoneId,
      cityIds.get(city),
      i === 0 ? 'pending' : 'confirmed',
      null,
      i === 0 ? 'not_done' : 'done',
      pick(random, operatorIds),
      buildSearchText(customer, rescuerFullName, vehicle, problem, address, phone, city, zone.zoneName),
      money.amount,
      money.loadType,
      money.garageDispatched,
      money.rate,
      money.commission,
      money.isPaid,
      money.isPaid ? `${today} 12:00:00` : null,
      money.isPaid ? adminId : null,
      money.isPaid ? money.commission : null,
    ]);
  }

  const chunkSize = 40;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const params = [];
    chunk.forEach((row, rowIndex) => {
      const base = rowIndex * 25;
      const holders = row.map((_, colIndex) => `$${base + colIndex + 1}`);
      values.push(`(${holders.join(', ')})`);
      params.push(...row);
    });

    await db.query(
      `INSERT INTO loads
        (load_date, vehicle_name, customer_phone, car_problem, customer_name, rescuer_id, rescuer_name,
         address, description, zone_id, city_id, status, cancel_reason, follow_up, created_by, search_text,
         amount_received, load_type, garage_dispatched, commission_rate, commission_amount,
         is_paid, paid_at, paid_by, paid_amount)
       VALUES ${values.join(', ')}`,
      params
    );
  }

  // ---- بستن روزهای قدیمی (شبیه‌سازی چرخه‌ی روزانه‌ی پنل) ----
  const closureDays = [addDays(today, -6), addDays(today, -5), addDays(today, -4)];
  for (const day of closureDays) {
    const exists = await db.one('SELECT day FROM day_closures WHERE day = $1::date', [day]);
    if (!exists) {
      await db.query('INSERT INTO day_closures (day, closed_by, note) VALUES ($1::date, $2, $3)', [
        day,
        adminId,
        'بسته‌شدن خودکار پایان روز',
      ]);
    }
  }

  log(`🚚 ${rows.length} بار ثبت شد.`);
  log('✅ داده‌ی نمونه با موفقیت ساخته شد.');
  return { seeded: true, loads: rows.length, rescuers: rescuerList.length };
}

module.exports = { seedDemo, ZONES, OPERATORS, RESCUERS, CANCEL_REASONS, todayStr };
