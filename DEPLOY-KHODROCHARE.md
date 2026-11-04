# 🚀 راهنمای دیپلوی پنل CRM روی سرور موجود (panel.khodrochare.ir)

این راهنما برای سروری نوشته شده که از قبل چند اپلیکیشن روی آن اجرا می‌شود:

| دامنه | مسیر فعلی | وضعیت |
| --- | --- | --- |
| `khodrochare.ir` | `/var/www/khodrochare` | سایت Next.js بدون بک‌اند |
| `app.khodrochare.ir` | `/var/www/khodrochare-app` | اپلیکیشن با بک‌اند |
| `safir.khodrochare.ir` | `/var/www/khodrochare-driver-application` | اپلیکیشن با بک‌اند |
| `panel.khodrochare.ir` | **`/var/www/khodrochare-panel`** | 🆕 پنل CRM (همین پروژه) |

اصل کار: **هیچ‌کدام از سرویس‌ها و کانفیگ‌های فعلی دست‌کاری نمی‌شود.** فقط یک پوشه، یک دیتابیس،
دو پروسه‌ی PM2 و یک `server` block جدید در Nginx اضافه می‌شود.

- پورت‌های پیشنهادی برای این پروژه (تا با اپ‌های موجود تداخل نکند): **API = 4100** و **Web = 3100**
- پایگاه داده: **`khodrochare_panel`** با کاربر اختصاصی **`khodro_panel`**
- پوشه‌ی پروژه: **`/var/www/khodrochare-panel`**

> لازم نیست سرور را ری‌استارت یا اپ‌های دیگر را متوقف کنید.

---

## گام ۰ — بازرسی سریع سرور (۲ دقیقه)

این دستورات را اجرا کنید و خروجی‌شان را ببینید؛ بر اساس آن، ادامه‌ی مسیر مشخص می‌شود:

```bash
# 1) چه چیزهایی روی PM2 است و روی چه پورت‌هایی؟
pm2 list

# 2) چه پورت‌هایی اشغال‌اند؟ (باید 3100 و 4100 آزاد باشند)
ss -ltnp | grep -E ':(80|443|3000|3001|3002|3100|4000|4100|5432)\b'

# 3) Nginx چه سایت‌هایی را سرو می‌کند؟
ls -l /etc/nginx/sites-enabled/
nginx -T | grep -E 'server_name|proxy_pass|listen'

# 4) فایل کانفیگ فرانت‌ها چیست؟
cat /var/www/khodrochare-fronts.config.cjs

# 5) Node و npm
node -v && npm -v                       # بهتر است 20 یا بالاتر باشد

# 6) وضعیت PostgreSQL (اگر نصبی نبود، پایین‌تر روش نصب هست)
systemctl status postgresql --no-pager
sudo -u postgres psql -c '\l' | head -20

# 7) داکر هست یا نه؟ (برای مسیر جایگزین)
docker ps 2>/dev/null | head

# 8) DNS ساب‌دامین جدید درست ست شده؟
dig +short panel.khodrochare.ir
```

**چه چیزی مهم است:**

- اگر پورت‌های `3100` و `4100` آزاد بودند → همین راهنما را ادامه دهید.
- اگر اشغال بودند → در `.env` و `deploy/ecosystem.config.cjs` مقدار `PANEL_API_PORT` و `PANEL_WEB_PORT` را عوض کنید و همان پورت‌ها را در کانفیگ Nginx بگذارید.
- اگر PostgreSQL نصب نبود → در «پیوست ۱» روش نصب آمده است. (اگر بک‌اندهای `app` و `safir` هم PostgreSQL دارند، احتمالاً از قبل نصب است؛ فقط دیتابیس جدید بسازید.)
- خروجی `dig` باید IP همان سرور باشد، وگرنه صدور SSL (certbot) انجام نمی‌شود.

---

## گام ۱ — قرار دادن کد در مسیر پروژه

```bash
cd /var/www

# الف) از گیت (توصیه‌شده)
git clone -b main https://github.com/amirabbasly/khodrochare-operator-panel.git khodrochare-panel

# ب) یا اگر آرشیو دارید:
# mkdir -p khodrochare-panel && tar -xzf khodrochare-panel.tar.gz -C khodrochare-panel --strip-components=1

cd /var/www/khodrochare-panel
ls        # باید package.json، backend/، frontend/، deploy/ را ببینید
```

> اگر سرور به گیت‌هاب دسترسی ندارد، از ماشین خودتان بزنید:
> `rsync -avz --exclude node_modules --exclude .next ./ root@SERVER_IP:/var/www/khodrochare-panel/`

---

## گام ۲ — ساخت پایگاه داده‌ی اختصاصی

```bash
cd /var/www/khodrochare-panel

# ۱) یک رمز قوی انتخاب کنید و در متغیر بگذارید
DBPASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
echo "رمز دیتابیس پنل: $DBPASS"      # این را جایی امن یادداشت کنید

# ۲) کاربر و دیتابیس را بسازید (اسکریپت idempotent است و دوباره‌اجرا بی‌خطر)
sudo bash deploy/create-db.sh "$DBPASS"

# ۳) تست اتصال
PGPASSWORD="$DBPASS" psql -h 127.0.0.1 -U khodro_panel -d khodrochare_panel -c 'select now();'

# ۴) رمز را برای گام بعد ذخیره کنید
echo "DATABASE_URL=postgres://khodro_panel:${DBPASS}@127.0.0.1:5432/khodrochare_panel"
```

> نام دیتابیس و کاربر عمداً از دیتابیس اپ‌های دیگر جدا است تا هیچ‌چیز قاطی نشود.
> اگر می‌خواهید از کاربر `postgres` استفاده کنید، حتماً رمز بگذارید و `pg_hba` را روی `scram-sha-256` نگه دارید.

---

## گام ۳ — فایل تنظیمات `.env`

```bash
cd /var/www/khodrochare-panel
cp .env.example .env
chmod 600 .env
nano .env
```

مقدارهای پیشنهادی برای این سرور (رمزها را با مقادیر واقعی خودتان بگذارید):

```env
NODE_ENV=production

# دیتابیس (خروجی گام ۲)
DATABASE_URL=postgres://khodro_panel:RAMZ-DB@127.0.0.1:5432/khodrochare_panel
DB_SSL=false

# API
PORT=4100
JWT_SECRET=خروجی-دستور-openssl-rand-hex-32
JWT_EXPIRES_IN=12h
APP_TIMEZONE=Asia/Tehran
CORS_ORIGINS=https://panel.khodrochare.ir
MIGRATE_ON_START=true

# مدیر اولیه (فقط بار اول ساخته می‌شود)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=یک-رمز-قوی-برای-مدیر
ADMIN_FIRST_NAME=مدیر
ADMIN_LAST_NAME=سیستم

# داده‌ی نمونه: در production حتماً false
AUTO_SEED=false
```

ساخت کلید JWT:

```bash
openssl rand -hex 32
```

> ⚠️ رمز پیش‌فرض `admin12345` را در production نگذارید. اگر هم گذاشتید، بعد از اولین ورود از
> دکمه‌ی «تغییر رمز عبور» عوضش کنید.

---

## گام ۴ — نصب وابستگی‌ها و بیلد

```bash
cd /var/www/khodrochare-panel

# بارگذاری .env در همین شل
set -a; source .env; set +a

npm ci --include-workspace-root

# ساخت جداول + حساب مدیر
npm run migrate

# بیلد فرانت‌اند (پروکسی API در بیلد ثبت می‌شود)
API_PROXY_TARGET="http://127.0.0.1:${PORT:-4100}" npm run build
```

اگر رم کم بود و بیلد با `Killed` قطع شد، ۲ گیگ swap اضافه کنید:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

---

## گام ۵ — اجرای سرویس‌ها با PM2

```bash
cd /var/www/khodrochare-panel
mkdir -p /var/log/khodrochare-panel

# پورت‌ها در خود فایل قابل تغییرند (default: 4100 / 3100)
pm2 start deploy/ecosystem.config.cjs
pm2 save

# وضعیت
pm2 list
pm2 logs khodrochare-panel-api --lines 40 --nostream
```

تست داخلی (قبل از Nginx):

```bash
curl -s http://127.0.0.1:4100/api/health        # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/login   # 200
```

`pm2 save` مطمئن می‌شود بعد از ری‌استارت سرور، این دو پروسه هم بالا بیایند
(اگر قبلاً `pm2 startup` را برای اپ‌های دیگر اجرا کرده‌اید، همان کافی است).

---

## گام ۶ — Nginx برای ساب‌دامین جدید + SSL

```bash
# ۱) کانفیگ آماده را در جای درست بگذارید
cp /var/www/khodrochare-panel/deploy/nginx/panel.khodrochare.ir.conf \
   /etc/nginx/sites-available/panel.khodrochare.ir

ln -s /etc/nginx/sites-available/panel.khodrochare.ir /etc/nginx/sites-enabled/panel.khodrochare.ir

# ۲) همیشه قبل از reload تست بگیرید (کانفیگ اپ‌های دیگر نباید بشکند)
nginx -t

# ۳) اگر OK بود:
systemctl reload nginx

# ۴) تست HTTP
curl -I http://panel.khodrochare.ir/login
```

محتویات فایل (خلاصه):

```nginx
upstream khodrochare_panel_web { server 127.0.0.1:3100; keepalive 32; }
upstream khodrochare_panel_api { server 127.0.0.1:4100; keepalive 16; }

server {
    listen 80;
    server_name panel.khodrochare.ir;
    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://khodrochare_panel_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static/ { proxy_pass http://khodrochare_panel_web; expires 1y; add_header Cache-Control "public, immutable"; }
    location /fonts/        { proxy_pass http://khodrochare_panel_web; expires 30d; }

    location / {
        proxy_pass http://khodrochare_panel_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

### SSL با Certbot

اگر certbot از قبل نصب است (چون سه دامنه‌ی دیگر HTTPS دارند):

```bash
certbot --nginx -d panel.khodrochare.ir --redirect -m info@khodrochare.ir --agree-tos
```

اگر نصب نیست:

```bash
apt update && apt install -y certbot python3-certbot-nginx
certbot --nginx -d panel.khodrochare.ir --redirect -m info@khodrochare.ir --agree-tos
```

بررسی تمدید خودکار:

```bash
systemctl list-timers | grep certbot
certbot renew --dry-run
```

> certbot فقط داخل همان `server` block مربوط به `panel.khodrochare.ir` تغییر ایجاد می‌کند؛
> کانفیگ دامنه‌های دیگر دست نمی‌خورد. با این حال قبل از هر تغییر `cp` پشتیبان بگیرید:
> `cp /etc/nginx/sites-available/panel.khodrochare.ir /root/nginx-panel-backup.conf`

### فایروال

```bash
ufw status            # اگر فعال است:
ufw allow 'Nginx Full'
ufw allow OpenSSH
# پورت‌های 3100 و 4100 را از بیرون باز نکنید (پروکسی از Nginx انجام می‌شود)
```

---

## گام ۷ — چک‌لیست بعد از نصب

```bash
curl -I https://panel.khodrochare.ir/login          # 200
curl -s https://panel.khodrochare.ir/api/health     # {"status":"ok"...}
pm2 list                                            # هر دو پروسه online
```

در مرورگر:

- [ ] صفحه‌ی ورود باز می‌شود و تب «مدیر / اپراتور» دیده می‌شود
- [ ] ورود با `ADMIN_USERNAME` / `ADMIN_PASSWORD` انجام می‌شود
- [ ] رمز مدیر از «تغییر رمز عبور» عوض شد
- [ ] یک اپراتور ساخته شد و با آن ورود شد
- [ ] یک امدادگر و یک بار ثبت شد، دکمه‌های تایید/کنسل و پیگیری کار می‌کنند
- [ ] گزارش‌ها و خروجی CSV کار می‌کنند
- [ ] در `/var/www/khodrochare-panel` فایل `.env` دسترسی `600` دارد

---

## بکاپ روزانه

```bash
mkdir -p /var/backups/khodrochare-panel
cat > /usr/local/bin/backup-khodrochare-panel.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DIR=/var/backups/khodrochare-panel
mkdir -p "$DIR"
sudo -u postgres pg_dump -Fc khodrochare_panel > "$DIR/panel-$(date +%F-%H%M).dump"
find "$DIR" -name 'panel-*.dump' -mtime +14 -delete
EOF
chmod +x /usr/local/bin/backup-khodrochare-panel.sh
/usr/local/bin/backup-khodrochare-panel.sh          # تست دستی

# هر شب ۲ بامداد
echo "0 2 * * * /usr/local/bin/backup-khodrochare-panel.sh" | crontab -
crontab -l
```

بازیابی:

```bash
sudo -u postgres pg_restore -d khodrochare_panel --clean --if-exists /var/backups/khodrochare-panel/panel-XXXX.dump
```

---

## آپدیت نسخه‌ها

```bash
cd /var/www/khodrochare-panel
bash deploy/deploy.sh --pull
```

این اسکریپت: `git pull` → `npm ci` → `npm run migrate` → `npm run build` → `pm2 reload` → تست سلامت.
اگر هر مرحله خطا بدهد، متوقف می‌شود و لاگ‌ها را نشان می‌دهد.

---

## عیب‌یابی مخصوص این سرور

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| `502 Bad Gateway` روی پنل | پروسه‌ی PM2 بالا نیست یا پورت اشتباه است | `pm2 list` و `pm2 logs khodrochare-panel-web --lines 50`؛ پورت داخل `deploy/ecosystem.config.cjs` و `upstream` در Nginx باید یکی باشند |
| `EADDRINUSE` در لاگ | پورت ۳۱۰۰ یا ۴۱۰۰ قبلاً گرفته شده | `ss -ltnp \| grep -E '3100\|4100'`؛ پورت را در `.env`/اکوسیستم/Nginx عوض کنید |
| `curl 127.0.0.1:4100` جواب می‌دهد اما از دامنه خطای ۵۰۲ | Nginx به پورت دیگری وصل است | `nginx -T \| grep -A3 panel` و اصلاح `upstream`، سپس `nginx -t && systemctl reload nginx` |
| ورود انجام می‌شود ولی بلافاصله خارج می‌شویم | `JWT_SECRET` عوض شده (توکن‌های قبلی نامعتبرند) | فقط دوباره وارد شوید؛ برای پایداری، `JWT_SECRET` را بعد از نصب تغییر ندهید |
| «ارتباط با سرور برقرار نشد» | مسیر `/api` به API نرسیده | `curl -s https://panel.khodrochare.ir/api/health`؛ اگر ۴۰۴ بود، `location /api/` را در Nginx چک کنید |
| `password authentication failed for user "khodro_panel"` | رمز در `.env` با رمز دیتابیس یکی نیست | رمز را با `ALTER ROLE khodro_panel PASSWORD '...'`ست و `.env` را همسان کنید، سپس `pm2 restart khodrochare-panel-api` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL نصب/فعال نیست | `systemctl status postgresql` یا پیوست ۱ |
| خطای `relation "users" does not exist` | مهاجرت اجرا نشده | `cd /var/www/khodrochare-panel && set -a && source .env && set +a && npm run migrate` |
| بیلد با `Killed` قطع می‌شود | کمبود RAM | swap ۲ گیگ (گام ۴) یا `NODE_OPTIONS=--max-old-space-size=1536` |
| تاریخ‌ها یک روز جابه‌جا هستند | منطقه‌ی زمانی | `APP_TIMEZONE=Asia/Tehran` در `.env` و `TZ=Asia/Tehran` برای PM2، سپس restart |
| certbot خطای DNS/challenge می‌دهد | دامنه به این سرور اشاره نمی‌کند یا پورت ۸۰ بسته است | `dig +short panel.khodrochare.ir` باید IP سرور باشد؛ `ufw allow 'Nginx Full'` |
| کند بودن فایل‌های استاتیک | کش Nginx | `location /_next/static/` و `/fonts/` در کانفیگ آماده هست؛ از همان فایل استفاده کنید |
| `git pull` تداخل دارد | تغییر لوکال روی سرور | `git stash` یا `git checkout -- .` قبل از pull (فایل `.env` در گیت نیست) |

---

## پیوست ۱ — اگر PostgreSQL نصب نیست

```bash
apt update && apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql
systemctl status postgresql --no-pager
```

اگر روی همین سرور اپ‌های دیگری هم دیتابیس دارند، نسخه را تغییر ندهید؛ فقط دیتابیس جدید بسازید.

---

## پیوست ۲ — مسیر جایگزین با Docker

اگر روی این سرور Docker دارید و ترجیح می‌دهید پنل هم داکری باشد، **بدون دست‌زدن به اپ‌های دیگر**
و با پورت‌های غیرمتعارف:

```bash
cd /var/www/khodrochare-panel
cp .env.example .env && nano .env      # JWT_SECRET، ADMIN_PASSWORD، CORS_ORIGINS

# پورت‌های میزبان را عوض کنید تا با اپ‌های موجود تداخل نکند
cat > .env.docker <<'EOF'
WEB_PORT=3100
API_PORT=4100
EOF

docker compose --env-file .env up -d --build
docker compose ps
```

در این حالت Nginx همان بالا دست نمی‌خورد (همان upstream روی 3100/4100).
توجه: دیتابیس این compose داخل کانتینر است؛ اگر می‌خواهید از PostgreSQL سرور استفاده کند،
در `docker-compose.yml` سرویس `db` را حذف و `DATABASE_URL` را به `127.0.0.1` اشاره دهید
(در Docker باید `host.docker.internal` یا IP سرور باشد).

---

## پیوست ۳ — نکات امنیتی این سرور

- `.env` پنل شامل `JWT_SECRET` و رمز دیتابیس است: `chmod 600 .env` و هرگز در گیت نگذارید.
- پورت‌های `3100` و `4100` را روی `127.0.0.1` نگه دارید (PM2 و Nginx همین کار را می‌کنند).
- `AUTO_SEED` را در production `false` بگذارید.
- در `CORS_ORIGINS` فقط دامنه‌ی پنل را مجاز کنید.
- دسترسی SSH را با کلید و `PasswordAuthentication no` محدود کنید.
- هر هفته `apt update && apt upgrade -y` و بررسی بکاپ‌ها.
- `deploy/create-db.sh` رمز را از آرگومان می‌گیرد؛ آن را در فایل ذخیره نکنید.

---

## نسخه‌ی ۲ — دسترسی‌ها، امنیت و صفحات جزئیات

### چه چیزی تغییر کرد؟

| موضوع | رفتار جدید |
| --- | --- |
| صفحه‌ی ورود | هیچ رمز یا حساب نمایشی روی صفحه نشان داده نمی‌شود. |
| سیاست رمز | حداقل ۱۰ کاراکتر + حداقل یک حرف انگلیسی + حداقل یک عدد + بدون نام کاربری/نام خود. هش با bcrypt (۱۲ دور). |
| تلاش ناموفق ورود | پس از ۵ رمز اشتباه، حساب ۱۵ دقیقه قفل می‌شود؛ پیام خطا درباره‌ی وجود یا نبود حساب اطلاعاتی نمی‌دهد. |
| تغییر رمز | فقط مدیر. اپراتور «فقط خواندن» است: نه رمز، نه اطلاعات حساب. مدیر از مسیر **اپراتورها → 🔑** رمز اپراتور را عوض می‌کند و همه‌ی نشست‌های قبلی او بسته می‌شود. |
| نشست‌ها | با هر تغییر رمز (توسط مدیر) `token_version` بالا می‌رود و توکن‌های قبلی باطل می‌شوند. غیرفعال‌سازی کاربر هم فوراً نشست‌ها را می‌بندد. |
| شهر و محدوده | اپراتور تایپ می‌کند (پیشنهادها با datalist)؛ نام جدید خودکار در `zones`/`cities` ساخته می‌شود تا آمار منطقه‌ای دقیق بماند. |
| تاریخ‌ها | همه‌ی ورودی‌های تاریخ **شمسی** است (۱۴۰۴/۰۸/۱۳) و در جدول‌ها تاریخ + ساعت شمسی نمایش داده می‌شود. |
| ستون امدادخواه | فقط نام و شماره‌ی تماس (بدون باکس/آواتار)؛ شماره قابل کلیک برای تماس است. |
| صفحات جزئیات (مدیر و اپراتور) | `/follow-ups/done` و `/follow-ups/not_done` — فهرست کامل بارهای پیگیری‌شده/نشده با جست‌وجو، فیلتر تاریخ، اطلاعات کامل بار و تغییر وضعیت. کارت‌های داشبورد هم به این صفحات لینک شده‌اند. |

### آپدیت سرور (داده‌ها حفظ می‌شود)

```bash
cd /var/www/khodrochare-panel
git pull
docker compose --env-file .env.docker up -d --build
```

ستون‌های امنیتی جدید در `migrate` خودکار اضافه می‌شوند (`token_version`, `failed_attempts`, `locked_until`, `password_changed_at`).

### اگر حسابی قفل شد

مدیر در صفحه‌ی **اپراتورها** دکمه‌ی 🔓 (رفع قفل) را بزند، یا:

```bash
curl -X PATCH https://panel.khodrochare.ir/api/users/<ID>/unlock \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

برای بازنشانی رمز یک اپراتور:

```bash
curl -X PATCH https://panel.khodrochare.ir/api/users/<ID>/password \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H 'Content-Type: application/json' \
  -d '{"newPassword":"NewStrongPass1404"}'
```

### متغیرهای اختیاری جدید در `.env`

```env
LOGIN_ACCOUNT_MAX_FAILURES=5
LOGIN_ACCOUNT_LOCK_MINUTES=15
LOGIN_IP_MAX_FAILURES=20
LOGIN_PAIR_MAX_FAILURES=10
```
