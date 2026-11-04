#!/usr/bin/env bash
# ============================================================
#  اسکریپت دیپلوی پنل CRM امداد خودرو  (panel.khodrochare.ir)
#  مسیر پروژه: /var/www/khodrochare-panel
#  اجرا:  bash deploy/deploy.sh          (یا: bash deploy/deploy.sh --pull)
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/khodrochare-panel}"
API_PORT="${PANEL_API_PORT:-4100}"
WEB_PORT="${PANEL_WEB_PORT:-3100}"
APP_NAME="khodrochare-panel"

log() { echo -e "\033[1;34m▸ $*\033[0m"; }
fail() { echo -e "\033[1;31m✖ $*\033[0m"; exit 1; }

cd "$APP_DIR" || fail "مسیر $APP_DIR پیدا نشد"

[[ -f .env ]] || fail "فایل .env وجود ندارد. ابتدا از .env.example بسازید: cp .env.example .env"

# بارگذاری متغیرها (برای DATABASE_URL و JWT_SECRET)
set -a; source .env; set +a

if [[ "${1:-}" == "--pull" ]]; then
  log "دریافت آخرین تغییرات از گیت…"
  git pull --ff-only
fi

log "نصب وابستگی‌ها (npm ci)…"
npm ci --include-workspace-root

log "اجرای مهاجرت پایگاه داده…"
npm run migrate

log "بیلد فرانت‌اند…"
export API_PROXY_TARGET="http://127.0.0.1:${API_PORT}"
npm run build

log "راه‌اندازی/ری‌استارت سرویس‌ها با PM2…"
mkdir -p /var/log/khodrochare-panel
if pm2 describe "$APP_NAME-api" >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

log "بررسی سلامت سرویس‌ها…"
sleep 4

API_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${API_PORT}/api/health" || true)
WEB_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WEB_PORT}/login" || true)

echo "   API  (127.0.0.1:${API_PORT}) → HTTP ${API_CODE}"
echo "   WEB  (127.0.0.1:${WEB_PORT}) → HTTP ${WEB_CODE}"

if [[ "$API_CODE" != "200" || "$WEB_CODE" != "200" ]]; then
  echo
  echo "— آخرین لاگ‌ها —"
  pm2 logs "$APP_NAME-api" --lines 30 --nostream || true
  pm2 logs "$APP_NAME-web" --lines 30 --nostream || true
  fail "یکی از سرویس‌ها سالم بالا نیامد. لاگ‌ها را بررسی کنید."
fi

log "✅ دیپلوی با موفقیت انجام شد → https://panel.khodrochare.ir"
