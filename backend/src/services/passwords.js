'use strict';

const bcrypt = require('bcryptjs');

/**
 * تعداد دورهای هش رمز عبور.
 * ۱۲ دور = کندتر شدن حمله‌ی بروت‌فورس روی هش‌های لو‌رفته (استاندارد امروز).
 * در حالت تست پایین نگه داشته می‌شود تا اجرای تست‌ها سریع بماند.
 */
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

/** هش ثابت برای مقایسه‌ی ساختگی (جلوگیری از لو رفتن وجود/عدم وجود نام کاربری با تحلیل زمان پاسخ) */
const DUMMY_HASH = bcrypt.hashSync('khodrochare-dummy-password-2024', BCRYPT_ROUNDS);

const COMMON_PASSWORDS = new Set([
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'admin123',
  'admin1234',
  'admin12345',
  'qwerty123',
  'iran12345',
  'khodrochare',
  'operator123',
]);

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), BCRYPT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(String(plain), String(hash || DUMMY_HASH));
}

/** حتی وقتی کاربر وجود ندارد، یک مقایسه‌ی واقعی انجام می‌دهد تا زمان پاسخ یکسان بماند */
async function burnCompare(plain) {
  await bcrypt.compare(String(plain), DUMMY_HASH);
  return false;
}

/** سیاست رمز عبور — پیام‌های فارسی برای نمایش مستقیم به کاربر */
const PASSWORD_RULES = [
  'حداقل ۱۰ کاراکتر',
  'حداقل یک حرف انگلیسی',
  'حداقل یک عدد',
  'نام کاربری یا نام خود نباشد',
];

function passwordProblems(value, { username, firstName, lastName } = {}) {
  const password = String(value ?? '');
  const problems = [];

  if (password.length < 10) problems.push('رمز عبور باید حداقل ۱۰ کاراکتر باشد.');
  if (password.length > 72) problems.push('رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد.');
  if (!/[A-Za-z]/.test(password)) problems.push('رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.');
  if (!/\d/.test(password)) problems.push('رمز عبور باید حداقل یک عدد داشته باشد.');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push('این رمز عبور بسیار رایج است؛ رمز دیگری انتخاب کنید.');

  const lowered = password.toLowerCase();
  for (const candidate of [username, firstName, lastName]) {
    const token = String(candidate ?? '')
      .trim()
      .toLowerCase();
    if (token.length >= 4 && lowered.includes(token)) {
      problems.push('رمز عبور نباید شامل نام کاربری یا نام و نام خانوادگی باشد.');
      break;
    }
  }

  return problems;
}

module.exports = {
  BCRYPT_ROUNDS,
  PASSWORD_RULES,
  hashPassword,
  verifyPassword,
  burnCompare,
  passwordProblems,
};
