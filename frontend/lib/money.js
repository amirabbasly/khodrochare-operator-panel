/**
 * کمک‌تابع‌های پول: قالب‌بندی سه‌رقمی با کاما و محاسبه‌ی سهم امدادگر.
 * طبق درخواست، مبالغ با ارقام لاتین و کاما نمایش داده می‌شوند: 1,000,000
 */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** درصد سهم امدادگر بر اساس نوع بار */
export const COMMISSION_RATES = {
  transport: 20,
  onsite_repair: 30,
  garage_dispatch: 30,
};

export const LOAD_TYPES = [
  { value: 'transport', label: 'حملی', icon: '🚚', hint: 'حمل خودرو با خودروی امداد' },
  { value: 'onsite_repair', label: 'تعمیر در محل', icon: '🛠️', hint: 'رفع مشکل در محل' },
  {
    value: 'garage_dispatch',
    label: 'امکان اعزام به تعمیرگاه',
    icon: '🏭',
    hint: 'در صورت نیاز به تعمیرگاه اعزام می‌شود',
  },
];

export const LOAD_TYPE_MAP = Object.fromEntries(LOAD_TYPES.map((item) => [item.value, item]));

/** ارقام فارسی/عربی → لاتین */
export function toLatin(value) {
  return String(value ?? '').replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (char) => {
    const fa = FA_DIGITS.indexOf(char);
    if (fa >= 0) return String(fa);
    const ar = AR_DIGITS.indexOf(char);
    return ar >= 0 ? String(ar) : char;
  });
}

/** هر ورودی کاربر → عدد صحیح (فقط رقم‌ها) */
export function parseAmount(value) {
  const digits = toLatin(value).replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 1000000 → "1,000,000" */
export function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "1,000,000 تومان" */
export function formatMoney(value, unit = 'تومان') {
  return `${formatAmount(value)}${unit ? ` ${unit}` : ''}`;
}

/** درصد ثابت هر نوع بار */
export function rateForType(loadType, rates = COMMISSION_RATES) {
  return rates[loadType] ?? rates.transport;
}

/** سهم امدادگر را همان‌طور که سرور حساب می‌کند، پیش‌بینی می‌کند */
export function previewCommission(amountReceived, loadType, rates = COMMISSION_RATES) {
  const amount = parseAmount(amountReceived);
  const rate = rateForType(loadType, rates);
  return { rate, amount: Math.round((amount * rate) / 100) };
}
