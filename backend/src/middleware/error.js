'use strict';

const { ApiError } = require('../utils/http');
const config = require('../config');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `مسیر «${req.originalUrl}» در سرور وجود ندارد.`,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  const status = error instanceof ApiError ? error.status : 500;
  const payload = {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message:
        error instanceof ApiError
          ? error.message
          : 'خطای غیرمنتظره‌ای در سرور رخ داد. لطفاً دوباره تلاش کنید.',
      details: error.details || undefined,
    },
  };

  if (status >= 500) {
    console.error('❌', req.method, req.originalUrl, '-', error.message);
    if (!config.isProd) console.error(error.stack);
  }

  res.status(status).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
