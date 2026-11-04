/**
 * تبدیل تاریخ میلادی ↔ شمسی (الگوریتم استاندارد jalaali)
 * همه‌ی توابع خالص هستند و مستقل از کتابخانه‌ی خارجی کار می‌کنند.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function div(a, b) {
  return Math.trunc(a / b);
}

function mod(a, b) {
  return a - Math.trunc(a / b) * b;
}

export function faToLatinDigits(value) {
  return String(value ?? '').replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(char);
    return arabicIndex >= 0 ? String(arabicIndex) : char;
  });
}

export function latinToFaDigits(value) {
  return String(value ?? '').replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
    2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm;
  let jump = 0;
  let n;
  let i;

  if (jy < jp || jy >= breaks[bl - 1]) throw new Error(`سال شمسی نامعتبر است: ${jy}`);

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm;
  let jd;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

const pad2 = (value) => String(value).padStart(2, '0');

/** «YYYY-MM-DD» میلادی → { jy, jm, jd } شمسی */
export function isoToJalali(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!match) return null;
  const [, gy, gm, gd] = match.map(Number);
  try {
    return d2j(g2d(gy, gm, gd));
  } catch {
    return null;
  }
}

/** سال/ماه/روز شمسی → «YYYY-MM-DD» میلادی */
export function jalaliToISO(jy, jm, jd) {
  const year = Number(jy);
  const month = Number(jm);
  const day = Number(jd);
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  try {
    const g = d2g(j2d(year, month, day));
    return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
  } catch {
    return null;
  }
}

/** «YYYY-MM-DD» → «۱۴۰۴/۰۸/۱۳» (برای مقدار ورودی متنی) */
export function isoToJalaliInput(iso) {
  const parts = isoToJalali(iso);
  if (!parts) return '';
  return latinToFaDigits(
    `${parts.jy}/${pad2(parts.jm)}/${pad2(parts.jd)}`
  );
}

/**
 * متن تایپ‌شده توسط کاربر (۱۴۰۴/۰۸/۱۳ یا 1404-8-13 یا ۱۴۰۴.۰۸.۱۳) → «YYYY-MM-DD»
 * در صورت نامعتبر بودن null برمی‌گرداند.
 */
export function parseJalaliInput(text) {
  const normalized = faToLatinDigits(text).trim().replace(/[.\-\s]+/g, '/');
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  return jalaliToISO(match[1], match[2], match[3]);
}

/** تاریخ شمسی امروز به شکل «۱۴۰۴/۰۸/۱۳» */
export function todayJalaliInput() {
  const now = new Date();
  const iso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  return isoToJalaliInput(iso);
}

/** برچسب شمسی + ساعت برای نمایش در جدول‌ها */
export function jalaliDateTimeLabel(isoDateTime) {
  if (!isoDateTime) return '—';
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '—';
  const iso = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const jalali = isoToJalaliInput(iso);
  const time = latinToFaDigits(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
  return `${jalali} · ${time}`;
}
