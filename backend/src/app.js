'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // سخت‌گیری امنیتی روی همه‌ی پاسخ‌های API
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
      noSniff: true,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
    })
  );

  const corsOptions = config.cors.origins.length
    ? {
        origin(origin, callback) {
          if (!origin || config.cors.origins.includes(origin)) return callback(null, true);
          return callback(null, false);
        },
        credentials: true,
      }
    : { origin: true, credentials: true };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!config.isTest) {
    app.use(morgan(config.isProd ? 'combined' : 'dev'));
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'khodrochare-crm-api',
      driver: config.db.driver,
      timezone: config.timezone,
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/rescuers', require('./routes/rescuers'));
  app.use('/api/loads', require('./routes/loads'));
  app.use('/api/days', require('./routes/days'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/meta', require('./routes/meta'));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
