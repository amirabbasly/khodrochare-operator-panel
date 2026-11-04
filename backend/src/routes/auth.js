'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const config = require('../config');
const { getDb } = require('../db');
const { parse, password: passwordSchema } = require('../utils/validation');
const { ApiError, asyncHandler } = require('../utils/http');
const { publicUser } = require('../utils/serialize');
const { authRequired, signToken, createLoginRateLimiter } = require('../middleware/auth');

const router = express.Router();

const ROLE_LABELS = { admin: 'مدیر', operator: 'اپراتور' };

const loginSchema = z.object({
  username: z
    .string({ required_error: 'نام کاربری را وارد کنید.' })
    .trim()
    .min(1, 'نام کاربری را وارد کنید.')
    .transform((value) => value.toLowerCase()),
  password: z.string({ required_error: 'رمز عبور را وارد کنید.' }).min(1, 'رمز عبور را وارد کنید.'),
  role: z.enum(['admin', 'operator']).optional(),
});

router.post(
  '/login',
  createLoginRateLimiter(),
  asyncHandler(async (req, res) => {
    const data = parse(loginSchema, req.body);
    const db = await getDb();
    const user = await db.one('SELECT * FROM users WHERE username = $1', [data.username]);

    if (!user) {
      throw new ApiError(401, 'نام کاربری یا رمز عبور اشتباه است.', 'INVALID_CREDENTIALS');
    }

    const passwordMatches = await bcrypt.compare(data.password, user.password_hash);
    if (!passwordMatches) {
      throw new ApiError(401, 'نام کاربری یا رمز عبور اشتباه است.', 'INVALID_CREDENTIALS');
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

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

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

router.post(
  '/change-password',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = parse(
      z.object({
        currentPassword: z.string().min(1, 'رمز فعلی را وارد کنید.'),
        newPassword: passwordSchema,
      }),
      req.body
    );

    const db = await getDb();
    const row = await db.one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const matches = await bcrypt.compare(data.currentPassword, row.password_hash);

    if (!matches) throw ApiError.badRequest('رمز فعلی صحیح نیست.');

    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      bcrypt.hashSync(data.newPassword, 10),
      req.user.id,
    ]);

    res.json({ message: 'رمز عبور با موفقیت تغییر کرد.' });
  })
);

router.post('/logout', (_req, res) => {
  res.json({ message: 'از حساب خارج شدید.' });
});

module.exports = router;
