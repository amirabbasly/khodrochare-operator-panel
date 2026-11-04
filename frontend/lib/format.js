const numberFormatter = new Intl.NumberFormat('fa-IR');

const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const persianDateShort = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: '2-digit',
  year: '2-digit',
});

const persianWeekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const persianDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('fa-IR', {
  hour: '2-digit',
  minute: '2-digit',
});

export function faNumber(value) {
  if (value === null || value === undefined || value === '') return '۰';
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return numberFormatter.format(parsed);
}

export function faPercent(value) {
  const parsed = Number(value) || 0;
  return `${numberFormatter.format(Math.round(parsed * 10) / 10)}٪`;
}

export function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function faDate(value) {
  const date = toDate(value);
  return date ? persianDate.format(date) : '—';
}

export function faDateShort(value) {
  const date = toDate(value);
  return date ? persianDateShort.format(date) : '—';
}

export function faDateWithWeekday(value) {
  const date = toDate(value);
  return date ? persianWeekday.format(date) : '—';
}

export function faDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : persianDateTime.format(date);
}

export function faTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(date);
}

export function jalaliToISO(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(dateStr, days) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function initials(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '+';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function faDigitsToLatin(value) {
  return String(value ?? '').replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(char);
    return arabicIndex >= 0 ? String(arabicIndex) : char;
  });
}

export function normalizePhoneInput(value) {
  return faDigitsToLatin(value).replace(/[^\d]/g, '').slice(0, 11);
}

export function normalizeDigits(value) {
  return faDigitsToLatin(value);
}
