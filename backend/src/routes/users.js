'use strict';

const express = require('express');
const { z } = require('zod');
const { getDb } = require('../db');
const { parse, username: usernameSchema, password: passwordSchema, optionalPhone, optionalNationalId, text, optionalText } = require('../utils/validation');
const {
  ApiError,
  asyncHandler,
  createWhere,
  buildUpdate,
  parsePagination,
  paginationMeta,
} = require('../utils/http');
const { publicUser } = require('../utils/serialize');
const { authRequired, adminOnly, USER_COLUMNS } = require('../middleware/auth');
const { hashPassword, passwordProblems } = require('../services/passwords');
const { passwordPolicyFor } = require('../utils/validation');

const router = express.Router();

router.use(authRequired, adminOnly);

const createSchema = z.object({
  firstName: text(80).min(1, 'نام را وارد کنید.'),
  lastName: text(80).min(1, 'نام خانوادگی را وارد کنید.'),
  username: usernameSchema,
  password: passwordSchema,
  phone: optionalPhone,
  nationalId: optionalNationalId,
  role: z.enum(['admin', 'operator']).default('operator'),
  isActive: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  firstName: text(80).min(1, 'نام را وارد کنید.').optional(),
  lastName: text(80).min(1, 'نام خانوادگی را وارد کنید.').optional(),
  username: usernameSchema.optional(),
  phone: optionalPhone,
  nationalId: optionalNationalId,
  role: z.enum(['admin', 'operator']).optional(),
  isActive: z.boolean().optional(),
  notes: optionalText(300),
});

/** آمار بارهای ثبت‌شده توسط هر کاربر */
async function loadStatsByUser(db, userIds) {
  if (!userIds.length) return new Map();
  const placeholders = userIds.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await db.many(
    `SELECT created_by,
            COUNT(*)::int AS total,
            SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending
     FROM loads
     WHERE created_by IN (${placeholders})
     GROUP BY created_by`,
    userIds
  );
  return new Map(
    rows.map((row) => [
      Number(row.created_by),
      {
        total: Number(row.total || 0),
        confirmed: Number(row.confirmed || 0),
        cancelled: Number(row.cancelled || 0),
        pending: Number(row.pending || 0),
      },
    ])
  );
}

function withStats(user, statsMap) {
  const serialized = publicUser(user);
  const stats = statsMap.get(Number(user.id)) || { total: 0, confirmed: 0, cancelled: 0, pending: 0 };
  return { ...serialized, stats };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50 });
    const where = createWhere();

    if (req.query.role) where.add('role = ?', String(req.query.role));
    if (req.query.isActive === 'true') where.raw('is_active = TRUE');
    if (req.query.isActive === 'false') where.raw('is_active = FALSE');

    const q = String(req.query.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      where.group([
        { sql: 'first_name ILIKE ?', value: like },
        { sql: 'last_name ILIKE ?', value: like },
        { sql: '(first_name || \' \' || last_name) ILIKE ?', value: like },
        { sql: 'username ILIKE ?', value: like },
        { sql: 'phone ILIKE ?', value: like },
      ]);
    }

    const total = Number(await db.scalar(`SELECT COUNT(*)::int AS count FROM users ${where.sql}`, where.params));
    const rows = await db.many(
      `SELECT ${USER_COLUMNS} FROM users ${where.sql} ORDER BY role ASC, created_at DESC LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, limit, offset]
    );

    const statsMap = await loadStatsByUser(db, rows.map((row) => row.id));

    res.json({
      items: rows.map((row) => withStats(row, statsMap)),
      pagination: paginationMeta({ page, limit, total }),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const row = await db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [Number(req.params.id)]);
    if (!row) throw ApiError.notFound('کاربر مورد نظر پیدا نشد.');
    const statsMap = await loadStatsByUser(db, [row.id]);
    res.json({ item: withStats(row, statsMap) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parse(createSchema, req.body);
    const db = await getDb();

    const problems = passwordProblems(data.password, {
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
    });
    if (problems.length) {
      throw ApiError.badRequest(problems[0], [{ field: 'password', message: problems[0] }]);
    }

    const existing = await db.one('SELECT id FROM users WHERE username = $1', [data.username]);
    if (existing) {
      throw ApiError.conflict('این نام کاربری قبلاً استفاده شده است.', [
        { field: 'username', message: 'نام کاربری تکراری است.' },
      ]);
    }

    const created = await db.one(
      `INSERT INTO users (first_name, last_name, username, password_hash, phone, national_id, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${USER_COLUMNS}`,
      [
        data.firstName,
        data.lastName,
        data.username,
        hashPassword(data.password),
        data.phone,
        data.nationalId,
        data.role,
        data.isActive !== false,
      ]
    );

    res.status(201).json({
      item: withStats(created, new Map()),
      message: 'کاربر جدید با موفقیت ساخته شد.',
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = parse(updateSchema, req.body);
    const db = await getDb();

    const current = await db.one('SELECT * FROM users WHERE id = $1', [id]);
    if (!current) throw ApiError.notFound('کاربر مورد نظر پیدا نشد.');

    if (id === req.user.id) {
      if (data.isActive === false) throw ApiError.badRequest('نمی‌توانید حساب خودتان را غیرفعال کنید.');
      if (data.role && data.role !== 'admin') {
        throw ApiError.badRequest('نمی‌توانید نقش مدیریتی حساب خودتان را حذف کنید.');
      }
    }

    if (current.role === 'admin' && (data.role === 'operator' || data.isActive === false)) {
      const activeAdmins = Number(
        await db.scalar("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE")
      );
      if (activeAdmins <= 1 && current.is_active) {
        throw ApiError.conflict('حداقل یک مدیر فعال باید در سیستم باقی بماند.');
      }
    }

    if (data.username && data.username !== current.username) {
      const duplicate = await db.one('SELECT id FROM users WHERE username = $1 AND id <> $2', [
        data.username,
        id,
      ]);
      if (duplicate) {
        throw ApiError.conflict('این نام کاربری قبلاً استفاده شده است.', [
          { field: 'username', message: 'نام کاربری تکراری است.' },
        ]);
      }
    }

    const changes = buildUpdate({
      first_name: data.firstName,
      last_name: data.lastName,
      username: data.username,
      phone: 'phone' in req.body ? data.phone : undefined,
      national_id: 'nationalId' in req.body ? data.nationalId : undefined,
      role: data.role,
      is_active: typeof data.isActive === 'boolean' ? data.isActive : undefined,
    });

    if (changes.isEmpty) {
      throw ApiError.badRequest('هیچ تغییری برای به‌روزرسانی ارسال نشده است.');
    }

    const updated = await db.one(
      `UPDATE users SET ${changes.sql}, updated_at = NOW()
       WHERE id = $${changes.nextIndex}
       RETURNING ${USER_COLUMNS}`,
      [...changes.params, id]
    );

    if (data.isActive === false) {
      // غیرفعال‌سازی فوری: همه‌ی نشست‌های فعال کاربر باطل می‌شوند
      await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [id]);
    }

    const statsMap = await loadStatsByUser(db, [id]);
    res.json({ item: withStats(updated, statsMap), message: 'اطلاعات کاربر به‌روزرسانی شد.' });
  })
);

router.patch(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = parse(z.object({ newPassword: passwordSchema }), req.body);
    const db = await getDb();

    const user = await db.one('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) throw ApiError.notFound('کاربر مورد نظر پیدا نشد.');

    const problems = passwordProblems(data.newPassword, {
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    });
    if (problems.length) {
      throw ApiError.badRequest(problems[0], [{ field: 'newPassword', message: problems[0] }]);
    }

    await db.query(
      `UPDATE users
         SET password_hash = $1, token_version = token_version + 1, password_changed_at = NOW(),
             failed_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [hashPassword(data.newPassword), id]
    );

    res.json({
      message: 'رمز عبور کاربر تغییر کرد و همه‌ی نشست‌های قبلی او بسته شد.',
      passwordPolicy: passwordPolicyFor(),
    });
  })
);

/** رفع قفل موقت حساب (پس از چند بار رمز اشتباه) — فقط مدیر */
router.patch(
  '/:id/unlock',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = await getDb();

    const user = await db.one('SELECT id FROM users WHERE id = $1', [id]);
    if (!user) throw ApiError.notFound('کاربر مورد نظر پیدا نشد.');

    await db.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: 'قفل حساب برداشته شد.' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = await getDb();

    const user = await db.one('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) throw ApiError.notFound('کاربر مورد نظر پیدا نشد.');

    if (id === req.user.id) throw ApiError.badRequest('حساب خودتان را نمی‌توانید حذف کنید.');

    if (user.role === 'admin') {
      const admins = Number(await db.scalar("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'"));
      if (admins <= 1) throw ApiError.conflict('آخرین مدیر سیستم قابل حذف نیست.');
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'کاربر حذف شد.' });
  })
);

module.exports = router;
