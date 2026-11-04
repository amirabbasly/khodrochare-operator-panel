'use strict';

/**
 * محاسبه‌ی سهم امدادگر از مبلغ دریافتی، بر اساس نوع بار.
 *
 *   حملی (transport)          → ۲۰٪
 *   تعمیر در محل (onsite)     → ۳۰٪
 *   امکان اعزام به تعمیرگاه   → ۳۰٪ (قابل تغییر با متغیر محیطی)
 *
 * درصدها از متغیرهای محیطی خوانده می‌شوند تا بدون تغییر کد قابل تنظیم باشند.
 */

const LOAD_TYPE_LABELS = {
  transport: 'حملی',
  onsite_repair: 'تعمیر در محل',
  garage_dispatch: 'امکان اعزام به تعمیرگاه',
};

function envRate(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
}

function rates() {
  return {
    transport: envRate('COMMISSION_TRANSPORT', 20),
    onsite_repair: envRate('COMMISSION_ONSITE', 30),
    garage_dispatch: envRate('COMMISSION_GARAGE', 30),
  };
}

function rateFor(loadType) {
  const table = rates();
  return table[loadType] ?? table.transport;
}

/** مبلغ را به عدد صحیح (ریال/تومان بدون اعشار) تبدیل می‌کند */
function normalizeAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

/** سهم امدادگر = درصد × مبلغ دریافتی (رند شده) */
function computeCommission(amountReceived, loadType) {
  const amount = normalizeAmount(amountReceived);
  const rate = rateFor(loadType);
  return {
    rate,
    amount: Math.round((amount * rate) / 100),
  };
}

function loadTypeLabel(type) {
  return LOAD_TYPE_LABELS[type] || type;
}

module.exports = {
  LOAD_TYPE_LABELS,
  rates,
  rateFor,
  computeCommission,
  normalizeAmount,
  loadTypeLabel,
};
