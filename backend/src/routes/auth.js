'use strict';

const express = require('express');
const { z } = require('zod');
const config = require('../config');
const { getDb } = require('../db');
const { parse, password: passwordSchema } = require('../utils/validation');
const { ApiError, asyncHandler } = require('../utils/http');
const { publicUser } = require('../utils/serialize');
const { authRequired, signToken, requireRole } = require('../middleware/auth');
const { hashPassword, verifyPassword, burnCompare, passwordProblems } = require('../services/passwords');
const guard = require('../services/loginGuard');

const router = express.Router();

const ROLE_LABELS = { admin: 'مدیر', operator: 'اپراتور' };

/** پیام یکسان برای همه‌ی حالت‌های شکست ⇒ هیچ اطلاعاتی درباره‌ی وجود حساب لو نمی‌رود */
const GENERIC_LOGIN_ERROR = 'نام کاربری یا رمز عبور اشتباه است.';

const loginSchema = z.object({
  username: z
    .string({ required_error: 'نام کاربری را وارد کنید.' })
    .trim()
    .min(1, 'نام کاربری را وارد کنید.')
    .max(60, 'نام کاربری معتبر نیست.')
    .transform((value) => value.toLowerCase()),
  password: z
    .string({ required_error: 'رمز عبور را وارد کنید.' })
    .min(1, 'رمز عبور را وارد کنید.')
    .max(72, 'رمز عبور معتبر نیست.'),
  role: z.enum(['admin', 'operator']).optional(),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = parse(loginSchema, req.body);

    guard.assertIpAllowed(req);
    guard.assertPairAllowed(req, data.username);

    const db = await getDb();
    const user = await db.one('SELECT * FROM users WHERE username = $1', [data.username]);

    if (!user) {
      await burnCompare(data.password);
      guard.registerFailure(req, data.username);
      throw new ApiError(401, GENERIC_LOGIN_ERROR, 'INVALID_CREDENTIALS');
    }

    const matches = await verifyPassword(data.password, user.password_hash);

    if (!matches) {
      const state = guard.nextAttemptState(user.failed_attempts);
      await db.query('UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3', [
        state.failedAttempts,
        state.lockedUntil,
        user.id,
      ]);
      guard.registerFailure(req, data.username);
      throw new ApiError(401, GENERIC_LOGIN_ERROR, 'INVALID_CREDENTIALS');
    }

    // رمز درست است اما حساب هنوز در دوره‌ی قفل به سر می‌برد
    const lockedMinutes = guard.accountLockedMinutes(user);
    if (lockedMinutes > 0) {
      throw new ApiError(
        429,
        `به دلیل تلاش‌های ناموفق قبلی، ورود این حساب تا ${lockedMinutes} دقیقه‌ی دیگر موقتاً قفل است. با مدیر سیستم تماس بگیرید.`,
        'ACCOUNT_LOCKED'
      );
    }

    if (!user.is_active) {
      throw new ApiError(403, 'حساب کاربری شما توسط مدیر غیرفعال شده است.', 'USER_DISABLED');
    }

    if (data.role && data.role !== user.role) {
      throw new ApiError(
        403,
        `این حساب از نوع «${ROLE_LABELS[user.role]}» است؛ لطفاً بخش «${ROLE_LABELS[user.role]}» را انتخاب کنید.`,
        'ROLE_MISMATCH'
      );
    }

    guard.registerSuccess(req, data.username);
    await db.query(
      'UPDATE users SET last_login_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    const token = signToken(user);
    res.json({
      token,
      user: publicUser({ ...user, last_login_at: new Date() }),
      expiresIn: config.jwt.expiresIn,
    });
  })
);

router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

/**
 * تغییر رمز عبور حساب جاری.
 * فقط مدیر سیستم مجاز است؛ اپراتور اجازه‌ی تغییر رمز خودش را ندارد
 * (رمز اپراتورها تنها از مسیر /users/:id/password و توسط مدیر تعیین می‌شود).
 */
router.post(
  '/change-password',
  authRequired,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({
        currentPassword: z.string().min(1, 'رمز فعلی را وارد کنید.').max(72),
        newPassword: passwordSchema,
      }),
      req.body
    );

    const db = await getDb();
    const row = await db.one('SELECT password_hash, token_version FROM users WHERE id = $1', [
      req.user.id,
    ]);
    const matches = await verifyPassword(data.currentPassword, row.password_hash);

    if (!matches) throw ApiError.badRequest('رمز فعلی صحیح نیست.');

    if (data.currentPassword === data.newPassword) {
      throw ApiError.badRequest('رمز جدید باید با رمز فعلی متفاوت باشد.');
    }

    const problems = passwordProblems(data.newPassword, {
      username: req.user.username,
      firstName: req.user.first_name,
      lastName: req.user.last_name,
    });
    if (problems.length) {
      throw ApiError.badRequest(problems[0], [{ field: 'newPassword', message: problems[0] }]);
    }

    const nextVersion = Number(row.token_version || 0) + 1;
    await db.query(
      `UPDATE users
         SET password_hash = $1, token_version = $2, password_changed_at = NOW(),
             failed_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $3`,
      [hashPassword(data.newPassword), nextVersion, req.user.id]
    );

    // توکن قبلی باطل شد؛ یک توکن تازه برمی‌گردانیم تا مدیر از پنل خارج نشود
    const token = signToken({
      id: req.user.id,
      role: req.user.role,
      username: req.user.username,
      token_version: nextVersion,
    });

    res.json({ message: 'رمز عبور تغییر کرد و سایر نشست‌ها بسته شدند.', token });
  })
);

router.post('/logout', (_req, res) => {
  res.json({ message: 'از حساب خارج شدید.' });
});

module.exports = router;
