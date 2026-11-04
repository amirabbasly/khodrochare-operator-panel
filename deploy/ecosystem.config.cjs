/**
 * پیکربندی PM2 برای پنل CRM امداد خودرو
 *
 * اجرا:
 *   cd /var/www/khodrochare-panel
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * توجه: متغیرهای محیطی از فایل /var/www/khodrochare-panel/.env خوانده می‌شوند
 * (بک‌اند با dotenv و cwd پروژه). فقط PORT و BIND_HOST را اینجا ثابت نگه می‌داریم
 * تا با اپلیکیشن‌های دیگر سرور تداخل نداشته باشند.
 */
const path = require('node:path');

const ROOT = __dirname ? path.resolve(__dirname, '..') : '/var/www/khodrochare-panel';

const API_PORT = process.env.PANEL_API_PORT || 4100;
const WEB_PORT = process.env.PANEL_WEB_PORT || 3100;

module.exports = {
  apps: [
    {
      name: 'khodrochare-panel-api',
      cwd: ROOT,
      script: 'backend/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '450M',
      env: {
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        TZ: 'Asia/Tehran',
      },
      error_file: '/var/log/khodrochare-panel/api-error.log',
      out_file: '/var/log/khodrochare-panel/api-out.log',
      time: true,
    },
    {
      name: 'khodrochare-panel-web',
      cwd: path.join(ROOT, 'frontend'),
      script: 'npm',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: String(WEB_PORT),
        BIND_HOST: '127.0.0.1',
        NEXT_TELEMETRY_DISABLED: '1',
        TZ: 'Asia/Tehran',
      },
      error_file: '/var/log/khodrochare-panel/web-error.log',
      out_file: '/var/log/khodrochare-panel/web-out.log',
      time: true,
    },
  ],
};
