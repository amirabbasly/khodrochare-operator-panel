'use strict';

/** اعتبارسنجی کد ملی ایران (۱۰ رقم با رقم کنترل) */
function isValidNationalId(value) {
  if (typeof value !== 'string') return false;
  const code = value.trim();
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // ارقام تکراری مثل ۱۱۱۱۱۱۱۱۱۱

  const digits = code.split('').map(Number);
  const check = digits[9];
  const sum = digits.slice(0, 9).reduce((acc, digit, index) => acc + digit * (10 - index), 0);
  const remainder = sum % 11;

  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/** تولید کد ملی معتبر (برای داده‌های نمونه) */
function generateNationalId(random = Math.random) {
  const digits = Array.from({ length: 9 }, () => Math.floor(random() * 10));
  const sum = digits.reduce((acc, digit, index) => acc + digit * (10 - index), 0);
  const remainder = sum % 11;
  const check = remainder < 2 ? remainder : 11 - remainder;
  return digits.join('') + String(check);
}

module.exports = { isValidNationalId, generateNationalId };
