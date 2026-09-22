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
  services_currency_symbol TEXT NOT NULL DEFAULT '₾',
  services_seeded BOOLEAN NOT NULL DEFAULT false,
  services_notice TEXT NOT NULL DEFAULT '',
  CONSTRAINT settings_single_row CHECK (id = 1)
);

-- Папки в сайдбаре, группирующие несколько категорий (например "Петли" →
-- "Петли Blum", "Петли Hettich"). Сами товары лежат в категориях, папка —
-- чисто организационная обёртка.
CREATE TABLE IF NOT EXISTS category_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pricing_mode TEXT NOT NULL DEFAULT 'direct',
  unit TEXT NOT NULL DEFAULT 'шт',
  icon TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  group_id TEXT REFERENCES category_groups(id) ON DELETE SET NULL,
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
  photos JSONB NOT NULL DEFAULT '[]',
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

-- На случай, если schema.sql выполняется повторно на уже существующей базе
-- (созданной до появления прайса услуг) — CREATE TABLE IF NOT EXISTS выше не
-- добавит новые колонки в уже существующую таблицу settings, поэтому отдельно:
ALTER TABLE settings ADD COLUMN IF NOT EXISTS services_currency_symbol TEXT NOT NULL DEFAULT '₾';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS services_seeded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS services_notice TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES category_groups(id) ON DELETE SET NULL;

-- ===================================================================
-- Прайс-лист услуг для монтажников + генератор ТЗ (технических заданий по монтажу, не
-- предложений). Отдельные таблицы от материалов/фурнитуры выше —
-- домен другой (работы, а не товары), но то же приложение и деплой.
-- ===================================================================

CREATE TABLE IF NOT EXISTS service_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- price_type: 'fixed' (фиксированная цена за ед.) | 'from' (цена "от", можно
-- увеличить при добавлении в ТЗ) | 'percent' (% от указанной суммы проекта)
-- | 'custom' (договорная — цену вводят вручную при добавлении в ТЗ).
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'шт',
  price_type TEXT NOT NULL DEFAULT 'fixed',
  price NUMERIC,
  note TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Готовые расчёты (ТЗ), которые менеджер составляет перед монтажом и
-- направляет монтажнику по ссылке (share_token — открывается без пароля).
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  share_token TEXT UNIQUE NOT NULL,
  title TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  object_address TEXT DEFAULT '',
  installer_name TEXT DEFAULT '',
  installer_phone TEXT DEFAULT '',
  project_amount NUMERIC,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Приложенные файлы (сборочные чертежи, эскизы) — храним содержимое как
-- base64 прямо в базе: для внутреннего инструмента с умеренными объёмами
-- это проще и надёжнее, чем поднимать отдельное объектное хранилище, и
-- одинаково работает и локально (JSON-файлы), и в Postgres/Vercel.
CREATE TABLE IF NOT EXISTS proposal_files (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size INT NOT NULL DEFAULT 0,
  data_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
-- Файлы документации у позиций прайса материалов/фурнитуры (спецификации,
-- сертификаты, инструкции и т.п.) — тот же подход, что и proposal_files
-- выше: содержимое как base64 в базе, список отдаёт только метаданные.
-- ===================================================================
CREATE TABLE IF NOT EXISTS item_files (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size INT NOT NULL DEFAULT 0,
  data_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_item_files_item ON item_files(item_id);

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_proposals_share_token ON proposals(share_token);
CREATE INDEX IF NOT EXISTS idx_proposal_files_proposal ON proposal_files(proposal_id);
