'use strict';

class ApiError extends Error {
  constructor(status, message, code = 'ERROR', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, 'VALIDATION_ERROR', details);
  }

  static unauthorized(message = 'برای ادامه باید وارد حساب خود شوید.') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'شما اجازه‌ی انجام این عملیات را ندارید.') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'موردی با این مشخصات پیدا نشد.') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message, details) {
    return new ApiError(409, message, 'CONFLICT', details);
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/** ساخت شرط‌های WHERE به‌صورت داینامیک و امن (پارامتری) */
function createWhere() {
  const conditions = [];
  const params = [];

  const api = {
    /** condition شامل ? است که با شماره‌ی پارامتر جایگزین می‌شود */
    add(condition, value) {
      params.push(value);
      conditions.push(condition.replace('?', `$${params.length}`));
      return api;
    },
    in(column, values) {
      if (!values || !values.length) return api;
      const holders = values.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      conditions.push(`${column} IN (${holders.join(', ')})`);
      return api;
    },
    /** گروهی از شرط‌ها که با OR به هم وصل می‌شوند */
    group(items, operator = 'OR') {
      if (!items || !items.length) return api;
      const parts = items.map(({ sql, value }) => {
        params.push(value);
        return sql.replace('?', `$${params.length}`);
      });
      conditions.push(`(${parts.join(` ${operator} `)})`);
      return api;
    },
    raw(condition) {
      conditions.push(condition);
      return api;
    },
    get params() {
      return params;
    },
    get sql() {
      return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    },
    get isEmpty() {
      return conditions.length === 0;
    },
  };

  return api;
}

/**
 * ساخت بخش SET برای UPDATE به‌صورت داینامیک
 * mapping: { column: value } — مقادیر undefined نادیده گرفته می‌شوند، null ست می‌شود
 */
function buildUpdate(mapping, startIndex = 1) {
  const assignments = [];
  const params = [];
  let index = startIndex;

  for (const [column, value] of Object.entries(mapping)) {
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${index}`);
    index += 1;
  }

  return {
    sql: assignments.join(', '),
    params,
    nextIndex: index,
    get isEmpty() {
      return assignments.length === 0;
    },
  };
}

function parsePagination(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = {
  ApiError,
  asyncHandler,
  createWhere,
  buildUpdate,
  parsePagination,
  paginationMeta,
};
