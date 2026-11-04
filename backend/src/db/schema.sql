-- ============================================================
--  پنل CRM امداد خودرو — اسکیمای پایگاه داده PostgreSQL
--  همه‌ی دستورات idempotent هستند (اجرای مجدد بی‌خطر است)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL,
  username      VARCHAR(60)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  phone         VARCHAR(20),
  national_id   VARCHAR(10),
  role          VARCHAR(20)  NOT NULL DEFAULT 'operator',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'operator'))
);

CREATE TABLE IF NOT EXISTS zones (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) NOT NULL UNIQUE,
  zone_id    INTEGER     NOT NULL REFERENCES zones (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rescuers (
  id          SERIAL PRIMARY KEY,
  first_name  VARCHAR(80) NOT NULL,
  last_name   VARCHAR(80) NOT NULL,
  phone       VARCHAR(20),
  vehicle     VARCHAR(80) NOT NULL,
  plate       VARCHAR(30) NOT NULL,
  zone_id     INTEGER REFERENCES zones (id) ON DELETE SET NULL,
  city_id     INTEGER REFERENCES cities (id) ON DELETE SET NULL,
  work_type   VARCHAR(20) NOT NULL DEFAULT 'both',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  notes       TEXT,
  search_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rescuers_work_type_check
    CHECK (work_type IN ('transport', 'onsite_repair', 'both', 'garage'))
);

CREATE TABLE IF NOT EXISTS loads (
  id             SERIAL PRIMARY KEY,
  load_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
  vehicle_name   VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(20)  NOT NULL,
  car_problem    VARCHAR(200) NOT NULL,
  customer_name  VARCHAR(120) NOT NULL,
  rescuer_id     INTEGER REFERENCES rescuers (id) ON DELETE SET NULL,
  rescuer_name   VARCHAR(120),
  address        TEXT,
  description    TEXT,
  zone_id        INTEGER REFERENCES zones (id) ON DELETE SET NULL,
  city_id        INTEGER REFERENCES cities (id) ON DELETE SET NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  cancel_reason  VARCHAR(200),
  follow_up      VARCHAR(20)  NOT NULL DEFAULT 'not_done',
  created_by     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  search_text    TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT loads_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  CONSTRAINT loads_follow_up_check CHECK (follow_up IN ('done', 'not_done'))
);

CREATE TABLE IF NOT EXISTS day_closures (
  day       DATE PRIMARY KEY,
  closed_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note      VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_loads_load_date ON loads (load_date);
CREATE INDEX IF NOT EXISTS idx_loads_status ON loads (status);
CREATE INDEX IF NOT EXISTS idx_loads_zone ON loads (zone_id);
CREATE INDEX IF NOT EXISTS idx_loads_city ON loads (city_id);
CREATE INDEX IF NOT EXISTS idx_loads_rescuer ON loads (rescuer_id);
CREATE INDEX IF NOT EXISTS idx_cities_zone ON cities (zone_id);
CREATE INDEX IF NOT EXISTS idx_rescuers_zone ON rescuers (zone_id);
