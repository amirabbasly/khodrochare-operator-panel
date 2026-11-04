#!/usr/bin/env bash
# ============================================================
#  ساخت کاربر و پایگاه داده‌ی اختصاصی پنل CRM
#  استفاده:
#     sudo bash deploy/create-db.sh 'RAMZ-GHOYI'
#  یا با متغیر محیطی:
#     DB_PASS='RAMZ-GHOYI' sudo -E bash deploy/create-db.sh
#
#  پیش‌فرض‌ها: DB_NAME=khodrochare_panel   DB_USER=khodro_panel
#  نکته: در رمز از کاراکتر تک‌کوتیشن (') استفاده نکنید.
# ============================================================
set -euo pipefail

DB_NAME="${DB_NAME:-khodrochare_panel}"
DB_USER="${DB_USER:-khodro_panel}"
DB_PASS="${1:-${DB_PASS:-}}"

if [[ -z "$DB_PASS" ]]; then
  echo "✖ رمز پایگاه داده را وارد کنید: sudo bash deploy/create-db.sh 'RAMZ-GHOYI'" >&2
  exit 1
fi

if [[ "$DB_PASS" == *"'"* ]]; then
  echo "✖ رمز نباید شامل کاراکتر تک‌کوتیشن باشد." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "✖ psql پیدا نشد. ابتدا PostgreSQL را نصب کنید (پیوست ۱ راهنما)." >&2
  exit 1
fi

echo "▸ ساخت/به‌روزرسانی کاربر «${DB_USER}»…"
if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" == "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASS}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASS}';"
fi

echo "▸ ساخت پایگاه داده «${DB_NAME}»…"
if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]]; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\" ENCODING 'UTF8' TEMPLATE template0;"
else
  echo "  (از قبل وجود داشت — رد شد)"
fi

echo "▸ اعطای دسترسی‌های لازم…"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" \
  -c "GRANT ALL ON SCHEMA public TO \"${DB_USER}\"; ALTER SCHEMA public OWNER TO \"${DB_USER}\";"

echo "▸ تست اتصال با کاربر جدید…"
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -tAc 'SELECT current_database(), current_user;'

echo
echo "✅ آماده است. این خط را در فایل .env پنل قرار دهید:"
echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
