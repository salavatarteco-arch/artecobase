// Драйвер хранения на Postgres (Neon) — используется, когда задан DATABASE_URL
// (деплой на Vercel и т.п.). Использует @neondatabase/serverless — HTTP-драйвер,
// который не держит постоянных TCP-соединений, поэтому безопасен для
// serverless-функций (в отличие от обычного pg.Pool, который там быстро
// исчерпывает лимит подключений).

const { neon } = require('@neondatabase/serverless');

let sql = null;
function db() {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// ---------- маппинг строк БД (snake_case) <-> объектов приложения (camelCase) ----------
function rowToCategory(r) {
  return {
    id: r.id,
    name: r.name,
    pricingMode: r.pricing_mode,
    unit: r.unit,
    icon: r.icon || '',
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}
function rowToItem(r) {
  return {
    id: r.id,
    categoryId: r.category_id,
    subcategory: r.subcategory || '',
    name: r.name,
    manufacturer: r.manufacturer || '',
    sku: r.sku || '',
    unit: r.unit || 'шт',
    pricingMode: r.pricing_mode,
    priceSheet: r.price_sheet != null ? Number(r.price_sheet) : null,
    heightM: r.height_m != null ? Number(r.height_m) : null,
    widthM: r.width_m != null ? Number(r.width_m) : null,
    thicknessMm: r.thickness_mm != null ? Number(r.thickness_mm) : null,
    cost: r.cost != null ? Number(r.cost) : 0,
    markupPercent: r.markup_percent != null ? Number(r.markup_percent) : null,
    retailOverride: r.retail_override != null ? Number(r.retail_override) : null,
    stockQty: r.stock_qty != null ? Number(r.stock_qty) : null,
    notes: r.notes || '',
    imageUrl: r.image_url || '',
    articles: r.articles || [],
    links: r.links || [],
    priceHistory: r.price_history || [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function rowToActivity(r) {
  return {
    id: r.id,
    at: r.at,
    itemId: r.item_id,
    itemName: r.item_name,
    linkId: r.link_id,
    status: r.status,
    message: r.message,
    price: r.price != null ? Number(r.price) : null,
  };
}

// ---------- settings ----------
async function getSettings() {
  const rows = await db()`SELECT * FROM settings WHERE id = 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    companyName: r.company_name,
    currency: r.currency,
    currencySymbol: r.currency_symbol,
    defaultMarkupPercent: Number(r.default_markup_percent),
    autoParseIntervalHours: r.auto_parse_interval_hours,
  };
}
async function setSettings(full) {
  await db()`
    UPDATE settings SET
      company_name = ${full.companyName},
      currency = ${full.currency},
      currency_symbol = ${full.currencySymbol},
      default_markup_percent = ${full.defaultMarkupPercent},
      auto_parse_interval_hours = ${full.autoParseIntervalHours}
    WHERE id = 1`;
  return full;
}

// ---------- categories ----------
async function listCategories() {
  const rows = await db()`SELECT * FROM categories ORDER BY sort_order ASC`;
  return rows.map(rowToCategory);
}
async function insertCategory(cat) {
  await db()`
    INSERT INTO categories (id, name, pricing_mode, unit, icon, sort_order, created_at)
    VALUES (${cat.id}, ${cat.name}, ${cat.pricingMode}, ${cat.unit}, ${cat.icon}, ${cat.sortOrder}, ${cat.createdAt})`;
  return cat;
}
async function updateCategoryRow(id, patch) {
  const rows = await db()`SELECT * FROM categories WHERE id = ${id}`;
  if (!rows[0]) return null;
  const merged = { ...rowToCategory(rows[0]), ...patch, id };
  await db()`
    UPDATE categories SET name = ${merged.name}, pricing_mode = ${merged.pricingMode},
      unit = ${merged.unit}, icon = ${merged.icon}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}`;
  return merged;
}
async function deleteCategoryRow(id) {
  await db()`DELETE FROM categories WHERE id = ${id}`;
}

// ---------- items ----------
async function listItems({ categoryId } = {}) {
  const rows = categoryId
    ? await db()`SELECT * FROM items WHERE category_id = ${categoryId} ORDER BY created_at ASC`
    : await db()`SELECT * FROM items ORDER BY created_at ASC`;
  return rows.map(rowToItem);
}
async function getItemById(id) {
  const rows = await db()`SELECT * FROM items WHERE id = ${id}`;
  return rows[0] ? rowToItem(rows[0]) : null;
}
async function insertItem(item) {
  await db()`
    INSERT INTO items (
      id, category_id, subcategory, name, manufacturer, sku, unit, pricing_mode,
      price_sheet, height_m, width_m, thickness_mm, cost, markup_percent, retail_override,
      stock_qty, notes, image_url, articles, links, price_history, created_at, updated_at
    ) VALUES (
      ${item.id}, ${item.categoryId}, ${item.subcategory}, ${item.name}, ${item.manufacturer},
      ${item.sku}, ${item.unit}, ${item.pricingMode}, ${item.priceSheet}, ${item.heightM},
      ${item.widthM}, ${item.thicknessMm}, ${item.cost}, ${item.markupPercent}, ${item.retailOverride},
      ${item.stockQty}, ${item.notes}, ${item.imageUrl}, ${JSON.stringify(item.articles)},
      ${JSON.stringify(item.links)}, ${JSON.stringify(item.priceHistory)}, ${item.createdAt}, ${item.updatedAt}
    )`;
  return item;
}
async function updateItemRow(id, patch) {
  const existing = await getItemById(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, id };
  await db()`
    UPDATE items SET
      category_id = ${merged.categoryId}, subcategory = ${merged.subcategory}, name = ${merged.name},
      manufacturer = ${merged.manufacturer}, sku = ${merged.sku}, unit = ${merged.unit},
      pricing_mode = ${merged.pricingMode}, price_sheet = ${merged.priceSheet}, height_m = ${merged.heightM},
      width_m = ${merged.widthM}, thickness_mm = ${merged.thicknessMm}, cost = ${merged.cost},
      markup_percent = ${merged.markupPercent}, retail_override = ${merged.retailOverride},
      stock_qty = ${merged.stockQty}, notes = ${merged.notes}, image_url = ${merged.imageUrl},
      articles = ${JSON.stringify(merged.articles)}, links = ${JSON.stringify(merged.links)},
      price_history = ${JSON.stringify(merged.priceHistory)}, updated_at = ${merged.updatedAt}
    WHERE id = ${id}`;
  return merged;
}
async function deleteItemRow(id) {
  await db()`DELETE FROM items WHERE id = ${id}`;
}

// ---------- activity ----------
async function listActivity(limit = 100) {
  const rows = await db()`SELECT * FROM activity ORDER BY at DESC LIMIT ${limit}`;
  return rows.map(rowToActivity);
}
async function insertActivity(entry) {
  await db()`
    INSERT INTO activity (id, at, item_id, item_name, link_id, status, message, price)
    VALUES (${entry.id}, ${entry.at}, ${entry.itemId}, ${entry.itemName}, ${entry.linkId},
            ${entry.status}, ${entry.message}, ${entry.price})`;
  return entry;
}

module.exports = {
  getSettings, setSettings,
  listCategories, insertCategory, updateCategoryRow, deleteCategoryRow,
  listItems, getItemById, insertItem, updateItemRow, deleteItemRow,
  listActivity, insertActivity,
};
