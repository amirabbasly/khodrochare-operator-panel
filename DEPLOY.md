# 🚀 راهنمای کامل دیپلوی روی سرور

این راهنما برای بالا آوردن پنل روی یک سرور لینوکسی (Ubuntu 22.04/24.04 یا Debian 12) نوشته شده است.
دو روش داریم:

- **روش A (پیشنهادی):** Docker + Docker Compose (پایگاه داده، API و وب هر سه با یک فرمان)
- **روش B:** نصب دستی با Node.js + PostgreSQL + PM2 (بدون Docker)

---

## ۰) پیش‌نیازها

| مورد | حداقل پیشنهادی |
| --- | --- |
| سرور | ۲ vCPU / ۲GB RAM / ۲۰GB SSD |
| سیستم‌عامل | Ubuntu 22.04+ یا Debian 12 |
| دامنه | مثلاً `crm.example.ir` (رکورد A به IP سرور) |
| پورت‌های باز | `22` (SSH)، `80`، `443` |

اتصال به سرور:

```bash
ssh root@SERVER_IP
```

---

## ۱) روش A — دیپلوی با Docker

### ۱-۱) نصب Docker

```bash
apt update && apt upgrade -y

# نصب Docker و Compose (اسکریپت رسمی)
curl -fsSL https://get.docker.com | sh

# اطمینان از نصب
docker --version
docker compose version
```

### ۱-۲) دریافت کد پروژه

```bash
mkdir -p /opt && cd /opt

# اگر پروژه روی GitHub است:
git clone https://github.com/USERNAME/khodrochare-operator-panel.git
cd khodrochare-operator-panel

# اگر فایل zip دارید:
# unzip khodrochare-operator-panel.zip -d /opt/khodrochare-operator-panel && cd /opt/khodrochare-operator-panel
```

### ۱-۳) تنظیم فایل محیطی

```bash
cp .env.example .env
nano .env
```

محتوای پیشنهادی برای production:

```env
DB_NAME=khodrochare_crm
DB_USER=khodrochare
DB_PASSWORD=رمز-قوی-دیتابیس
DB_PORT=5432

API_PORT=4000
WEB_PORT=3000
JWT_SECRET=کلید-تصادفی-طولانی   # با openssl rand -hex 32 بسازید
JWT_EXPIRES_IN=12h
APP_TIMEZONE=Asia/Tehran

ADMIN_USERNAME=admin
ADMIN_PASSWORD=رمز-قوی-مدیر

AUTO_SEED=false
CORS_ORIGINS=https://crm.example.ir
```

ساخت کلید امن:

```bash
openssl rand -hex 32
```

> ⚠️ فایل `.env` را در گیت commit نکنید و دسترسی آن را محدود کنید: `chmod 600 .env`

### ۱-۴) ساخت و اجرا

```bash
docker compose up -d --build
```

بررسی وضعیت:

```bash
docker compose ps
docker compose logs -f api      # لاگ API
docker compose logs -f web      # لاگ وب
```

پس از بالا آمدن:

- `http://SERVER_IP:3000` → پنل
- `http://SERVER_IP:4000/api/health` → سلامت API

### ۱-۵) داده‌ی نمونه (اختیاری — فقط برای تست)

```bash
docker compose exec api node src/db/seed.js
```

### ۱-۶) اجرای دستی مهاجرت (در صورت نیاز)

مهاجرت هنگام بالا آمدن API به‌صورت خودکار اجرا می‌شود (`MIGRATE_ON_START=true`).
اگر خواستید دستی اجرا کنید:

```bash
docker compose exec api node src/db/migrate.js
```

---

## ۲) Nginx به‌عنوان Reverse Proxy + دامنه

نصب Nginx:

```bash
apt install -y nginx
```

فایل `/etc/nginx/sites-available/khodrochare` را بسازید:

```nginx
server {
    listen 80;
    server_name crm.example.ir;

    client_max_body_size 10m;

    # پنل (Next.js) — پروکسی داخلی /api هم از همین‌جا انجام می‌شود
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # اگر می‌خواهید API را جدا هم expose کنید (اختیاری)
    location /api-direct/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

فعال‌سازی:

```bash
ln -s /etc/nginx/sites-available/khodrochare /etc/nginx/sites-enabled/khodrochare
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### ۲-۱) SSL رایگان با Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d crm.example.ir --redirect -m info@example.ir --agree-tos
```

تمدید خودکار تست:

```bash
certbot renew --dry-run
```

### ۲-۲) بستن پورت‌های مستقیم (امنیت)

پس از فعال شدن Nginx، بهتر است پورت‌های `3000` و `4000` از بیرون در دسترس نباشند.
در `docker-compose.yml` مقدار پورت‌ها را به loopback محدود کنید:

```yaml
  api:
    ports:
      - '127.0.0.1:4000:4000'
  web:
    ports:
      - '127.0.0.1:3000:3000'
```

سپس:

```bash
docker compose up -d
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## ۳) دیپلوی بدون Docker (روش B)

### ۳-۱) نصب Node.js و PostgreSQL

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs build-essential

# PostgreSQL
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
```

### ۳-۲) ساخت دیتابیس

```bash
sudo -u postgres psql <<'SQL'
CREATE USER khodrochare WITH PASSWORD 'رمز-قوی';
CREATE DATABASE khodrochare_crm OWNER khodrochare;
GRANT ALL PRIVILEGES ON DATABASE khodrochare_crm TO khodrochare;
SQL
```

### ۳-۳) نصب پروژه

```bash
cd /opt/khodrochare-operator-panel
npm ci

cp .env.example .env
nano .env      # DATABASE_URL=postgres://khodrochare:رمز-قوی@127.0.0.1:5432/khodrochare_crm

export $(grep -v '^#' .env | xargs)
npm run migrate
npm run seed      # اختیاری
npm run build     # بیلد فرانت‌اند
```

### ۳-۴) اجرا با PM2

```bash
npm install -g pm2

pm2 start npm --name "kcrm-api" -- run start:api
pm2 start npm --name "kcrm-web" -- run start:web

pm2 save
pm2 startup      # دستور خروجی را اجرا کنید تا پس از ری‌استارت بالا بیاید
```

لاگ‌ها:

```bash
pm2 logs kcrm-api
pm2 logs kcrm-web
pm2 status
```

> در روش B، هنگام بیلد فرانت‌اند (یا در فایل `.env` قبل از build) مقدار
> `API_PROXY_TARGET=http://127.0.0.1:4000` را ست کنید، زیرا پروکسی `/api` در زمان build ثبت می‌شود.

---

## ۴) پشتیبان‌گیری و بازیابی

### بکاپ روزانه دیتابیس (Docker)

```bash
mkdir -p /opt/backups
docker compose exec -T db pg_dump -U khodrochare khodrochare_crm | gzip > /opt/backups/crm-$(date +%F).sql.gz
```

اسکریپت کامل `/opt/backups/backup.sh`:

```bash
#!/usr/bin/env bash
set -e
BACKUP_DIR=/opt/backups
cd /opt/khodrochare-operator-panel
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/crm-$(date +%F-%H%M).sql.gz"
find "$BACKUP_DIR" -name 'crm-*.sql.gz' -mtime +14 -delete
```

```bash
chmod +x /opt/backups/backup.sh
# اجرای خودکار هر شب ساعت ۲ بامداد
echo "0 2 * * * /opt/backups/backup.sh" | crontab -
```

### بازیابی

```bash
gunzip -c /opt/backups/crm-2026-11-04.sql.gz | docker compose exec -T db psql -U khodrochare -d khodrochare_crm
```

---

## ۵) به‌روزرسانی نسخه

```bash
cd /opt/khodrochare-operator-panel

# بکاپ قبل از آپدیت
/opt/backups/backup.sh

git pull
docker compose up -d --build
docker compose logs -f api
```

مهاجرت‌های جدید هنگام بالا آمدن API خودکار اجرا می‌شوند و داده‌های موجود حفظ می‌شوند.

---

## ۶) چک‌لیست بعد از نصب

- [ ] `docker compose ps` → هر سه سرویس `Up` (و دیتابیس `healthy`)
- [ ] `curl -I https://crm.example.ir/login` → پاسخ ۲۰۰
- [ ] ورود با حساب مدیر و **تغییر رمز** در همان روز
- [ ] ساخت حداقل یک اپراتور واقعی و تست ورود او
- [ ] ساخت چند امدادگر و ثبت یک بار نمونه
- [ ] بررسی خروجی CSV و صفحه گزارش‌ها
- [ ] فعال بودن بکاپ شبانه (`crontab -l`)
- [ ] `certbot renew --dry-run` بدون خطا

---

## ۷) رفع اشکال‌های رایج

| مشکل | علت و راه‌حل |
| --- | --- |
| API بالا نمی‌آید و پیام `JWT_SECRET تعریف نشده` می‌دهد | در `.env` مقدار `JWT_SECRET` را ست کنید؛ در production مقدار پیش‌فرض پذیرفته نمی‌شود |
| `docker compose up` با خطای `port is already allocated` | پورت ۳۰۰۰/۴۰۰۰ اشغال است: `ss -ltnp \| grep 3000` و سرویس متضاد را متوقف کنید یا `WEB_PORT`/`API_PORT` را تغییر دهید |
| صفحه ورود باز می‌شود اما «ارتباط با سرور برقرار نشد» | پروکسی `/api` به API نرسیده است: `API_PROXY_TARGET` و لاگ `docker compose logs web` را بررسی کنید (در حالت Docker باید `http://api:4000` باشد) |
| `next build` در Docker با OOM متوقف می‌شود | رم سرور کم است: یک `swapfile` ۲GB بسازید یا بیلد را روی ماشین دیگری انجام دهید |
| بار «روز بسته شده» قابل ویرایش نیست | این رفتار عمدی است: از دکمه‌ی **بازگشایی روز** در صفحه بارها استفاده کنید |
| جست‌وجوی «امیرکریمی» نتیجه نمی‌دهد | ایندکس جست‌وجو خالی است؛ `docker compose exec api node src/db/migrate.js` را اجرا کنید تا ایندکس بازسازی شود |
| تاریخ‌ها یک روز جابه‌جا هستند | `APP_TIMEZONE` را روی `Asia/Tehran` تنظیم و سرویس را ری‌استارت کنید |
| ورود نمی‌شود و پیام «حساب غیرفعال» | مدیر حساب را غیرفعال کرده است؛ از پنل مدیر فعالش کنید |

---

## ۸) نکات مقیاس‌پذیری

- فایل `docker-compose.yml` را با `deploy.resources` یا یک `nginx` با کش استاتیک تنظیم کنید.
- برای بارهای زیاد: `DB_POOL_MAX` را بالا ببرید و روی جدول‌های `loads(load_date)`، `status`، `zone_id`، `city_id`، `rescuer_id` ایندکس دارید (در اسکیما ساخته شده است).
- گزارش‌های سنگین را در ساعات کم‌ترافیک بگیرید یا خروجی CSV روزانه را با cron بسازید.
- برای چند سرور، PostgreSQL را از طریق سرویس مدیریت‌شده (RDS/Cloud SQL) و `DB_SSL=true` استفاده کنید.
