-- Схема базы данных прайс-листа АРТЕКО (PostgreSQL / Neon).
-- Выполнить один раз на новой базе перед первым запуском с DATABASE_URL,
-- либо перед запуском scripts/migrate-to-postgres.js.

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'АРТЕКО',
  currency TEXT NOT NULL DEFAULT 'GEL',
  currency_symbol TEXT NOT NULL DEFAULT '₾',
  default_markup_percent NUMERIC NOT NULL DEFAULT 200,
  auto_parse_interval_hours INT NOT NULL DEFAULT 0,
  CONSTRAINT settings_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pricing_mode TEXT NOT NULL DEFAULT 'direct',
  unit TEXT NOT NULL DEFAULT 'шт',
  icon TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  subcategory TEXT DEFAULT '',
  name TEXT NOT NULL,
  manufacturer TEXT DEFAULT '',
  sku TEXT DEFAULT '',
  unit TEXT DEFAULT 'шт',
  pricing_mode TEXT NOT NULL DEFAULT 'direct',
  price_sheet NUMERIC,
  height_m NUMERIC,
  width_m NUMERIC,
  thickness_mm NUMERIC,
  cost NUMERIC DEFAULT 0,
  markup_percent NUMERIC,
  retail_override NUMERIC,
  stock_qty NUMERIC,
  notes TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  articles JSONB NOT NULL DEFAULT '[]',
  links JSONB NOT NULL DEFAULT '[]',
  price_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_id TEXT,
  item_name TEXT,
  link_id TEXT,
  status TEXT,
  message TEXT,
  price NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at DESC);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
