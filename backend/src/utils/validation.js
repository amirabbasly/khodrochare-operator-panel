'use strict';

const { z } = require('zod');
const { ApiError } = require('./http');
const { isDateStr } = require('./dates');
const { isValidNationalId } = require('./nationalId');

const phone = z
  .string()
  .trim()
  .regex(/^09\d{9}$/, 'شماره تماس باید ۱۱ رقم و با ۰۹ شروع شود.');

const optionalPhone = z
  .union([z.string().trim().regex(/^0\d{10}$/, 'شماره تماس معتبر نیست.'), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

const nationalId = z
  .string()
  .trim()
  .refine((value) => isValidNationalId(value), 'کد ملی وارد شده معتبر نیست.');

const optionalNationalId = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || isValidNationalId(value), 'کد ملی وارد شده معتبر نیست.');

const dateStr = z
  .string()
  .trim()
  .refine((value) => isDateStr(value), 'تاریخ باید به شکل ۲۰۲۶-۰۱-۰۱ (YYYY-MM-DD) باشد.');

const optionalDateStr = z
  .union([dateStr, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

const text = (max = 200) => z.string().trim().max(max, `حداکثر ${max} کاراکتر مجاز است.`);

const optionalText = (max = 200) =>
  z
    .union([text(max), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value));

const id = z.coerce.number().int().positive('شناسه معتبر نیست.');

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{4,30}$/, 'نام کاربری باید ۴ تا ۳۰ کاراکتر و شامل حروف انگلیسی، عدد، نقطه یا خط زیر باشد.');

const password = z
  .string({ required_error: 'رمز عبور را وارد کنید.' })
  .min(10, 'رمز عبور باید حداقل ۱۰ کاراکتر باشد.')
  .max(72, 'رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد.')
  .refine((value) => /[A-Za-z]/.test(value), 'رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.')
  .refine((value) => /\d/.test(value), 'رمز عبور باید حداقل یک عدد داشته باشد.');

const statusEnum = z.enum(['pending', 'confirmed', 'cancelled'], {
  errorMap: () => ({ message: 'وضعیت باید یکی از pending / confirmed / cancelled باشد.' }),
});

const followUpEnum = z.enum(['done', 'not_done'], {
  errorMap: () => ({ message: 'وضعیت پیگیری باید done یا not_done باشد.' }),
});

const workTypeEnum = z.enum(['transport', 'onsite_repair', 'both', 'garage'], {
  errorMap: () => ({ message: 'نوع کار امدادگر معتبر نیست.' }),
});

/** سیاست رمز عبور برای نمایش در رابط کاربری */
function passwordPolicyFor() {
  const { PASSWORD_RULES } = require('../services/passwords');
  return { minLength: 10, maxLength: 72, rules: PASSWORD_RULES };
}

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'general',
      message: issue.message,
    }));
    throw ApiError.badRequest(details[0]?.message || 'اطلاعات ارسالی معتبر نیست.', details);
  }
  return result.data;
}

module.exports = {
  z,
  parse,
  passwordPolicyFor,
  phone,
  optionalPhone,
  nationalId,
  optionalNationalId,
  dateStr,
  optionalDateStr,
  text,
  optionalText,
  id,
  username,
  password,
  statusEnum,
  followUpEnum,
  workTypeEnum,
};
