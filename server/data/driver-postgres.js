// Драйвер хранения на Postgres (Neon) — используется, когда задан DATABASE_URL
// (деплой на Vercel и т.п.). Использует @neondatabase/serverless — HTTP-драйвер,
// который не держит постоянных TCP-соединений, поэтому безопасен для
// serverless-функций (в отличие от обычного pg.Pool, который там быстро
// исчерпывает лимит подключений).

const { neon } = require('@neondatabase/serverless');

let rawSql = null;
function rawDb() {
  if (!rawSql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан');
    rawSql = neon(process.env.DATABASE_URL);
  }
  return rawSql;
}

// Один повтор при кратковременном сбое соединения — например, "холодный
// старт" простаивавшего Neon-компьюта иногда не успевает поднять реплику к
// первому запросу. Без этого такой момент выглядел как случайный 500 при
// создании позиции/обновлении цены, хотя повторный запрос сразу проходил.
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// Лёгкие "самонакатывающиеся" миграции для колонок, добавленных уже после
// первого деплоя — ADD COLUMN IF NOT EXISTS идемпотентен, поэтому безопасно
// гонять его на каждом холодном старте (кешируем промис, чтобы не дублировать
// в рамках одного тёплого инстанса).
let schemaEnsured = null;
function ensureSchema(client) {
  if (!schemaEnsured) {
    schemaEnsured = (async () => {
      await client`ALTER TABLE items ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'`;
      await client`
        CREATE TABLE IF NOT EXISTS category_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await client`ALTER TABLE categories ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES category_groups(id) ON DELETE SET NULL`;
    })().catch((err) => { schemaEnsured = null; throw err; });
  }
  return schemaEnsured;
}

function db() {
  const client = rawDb();
  return async function tagged(...args) {
    await ensureSchema(client);
    try {
      return await client(...args);
    } catch (err) {
      await sleep(350);
      return client(...args);
    }
  };
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
    groupId: r.group_id || null,
    createdAt: r.created_at,
  };
}
function rowToCategoryGroup(r) {
  return { id: r.id, name: r.name, sortOrder: r.sort_order, createdAt: r.created_at };
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
    photos: r.photos || [],
    articles: r.articles || [],
    links: r.links || [],
    priceHistory: r.price_history || [],
    fileCount: r.file_count != null ? Number(r.file_count) : 0,
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
function rowToServiceCategory(r) {
  return { id: r.id, name: r.name, icon: r.icon || '', sortOrder: r.sort_order, createdAt: r.created_at };
}
function rowToService(r) {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    unit: r.unit || 'шт',
    priceType: r.price_type,
    price: r.price != null ? Number(r.price) : null,
    note: r.note || '',
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function rowToProposal(r) {
  return {
    id: r.id,
    shareToken: r.share_token,
    title: r.title || '',
    clientName: r.client_name || '',
    clientPhone: r.client_phone || '',
    objectAddress: r.object_address || '',
    installerName: r.installer_name || '',
    installerPhone: r.installer_phone || '',
    projectAmount: r.project_amount != null ? Number(r.project_amount) : null,
    notes: r.notes || '',
    status: r.status,
    items: r.items || [],
    totalAmount: r.total_amount != null ? Number(r.total_amount) : 0,
    createdBy: r.created_by || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function rowToProposalFileMeta(r) {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    filename: r.filename,
    mimeType: r.mime_type,
    size: r.size,
    createdAt: r.created_at,
  };
}
function rowToItemFileMeta(r) {
  return {
    id: r.id,
    itemId: r.item_id,
    filename: r.filename,
    mimeType: r.mime_type,
    size: r.size,
    createdAt: r.created_at,
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
    servicesCurrencySymbol: r.services_currency_symbol,
    servicesSeeded: r.services_seeded,
    servicesNotice: r.services_notice,
  };
}
async function setSettings(full) {
  await db()`
    UPDATE settings SET
      company_name = ${full.companyName},
      currency = ${full.currency},
      currency_symbol = ${full.currencySymbol},
      default_markup_percent = ${full.defaultMarkupPercent},
      auto_parse_interval_hours = ${full.autoParseIntervalHours},
      services_currency_symbol = ${full.servicesCurrencySymbol},
      services_seeded = ${full.servicesSeeded},
      services_notice = ${full.servicesNotice}
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
    INSERT INTO categories (id, name, pricing_mode, unit, icon, sort_order, group_id, created_at)
    VALUES (${cat.id}, ${cat.name}, ${cat.pricingMode}, ${cat.unit}, ${cat.icon}, ${cat.sortOrder}, ${cat.groupId}, ${cat.createdAt})`;
  return cat;
}
async function updateCategoryRow(id, patch) {
  const rows = await db()`SELECT * FROM categories WHERE id = ${id}`;
  if (!rows[0]) return null;
  const merged = { ...rowToCategory(rows[0]), ...patch, id };
  await db()`
    UPDATE categories SET name = ${merged.name}, pricing_mode = ${merged.pricingMode},
      unit = ${merged.unit}, icon = ${merged.icon}, sort_order = ${merged.sortOrder}, group_id = ${merged.groupId}
    WHERE id = ${id}`;
  return merged;
}
async function deleteCategoryRow(id) {
  await db()`DELETE FROM categories WHERE id = ${id}`;
}

// ---------- category groups (папки в сайдбаре) ----------
async function listCategoryGroups() {
  const rows = await db()`SELECT * FROM category_groups ORDER BY sort_order ASC`;
  return rows.map(rowToCategoryGroup);
}
async function insertCategoryGroup(group) {
  await db()`
    INSERT INTO category_groups (id, name, sort_order, created_at)
    VALUES (${group.id}, ${group.name}, ${group.sortOrder}, ${group.createdAt})`;
  return group;
}
async function updateCategoryGroupRow(id, patch) {
  const rows = await db()`SELECT * FROM category_groups WHERE id = ${id}`;
  if (!rows[0]) return null;
  const merged = { ...rowToCategoryGroup(rows[0]), ...patch, id };
  await db()`
    UPDATE category_groups SET name = ${merged.name}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}`;
  return merged;
}
async function deleteCategoryGroupRow(id) {
  await db()`DELETE FROM category_groups WHERE id = ${id}`;
}

// ---------- items ----------
// Число прикреплённых файлов считаем тут же (LEFT JOIN на сгруппированный
// подзапрос) — чтобы в списке позиций сразу было видно, у кого есть
// документация, без отдельного запроса на каждую строку.
async function listItems({ categoryId } = {}) {
  const rows = categoryId
    ? await db()`
        SELECT items.*, COALESCE(fc.cnt, 0) AS file_count FROM items
        LEFT JOIN (SELECT item_id, COUNT(*)::int AS cnt FROM item_files GROUP BY item_id) fc ON fc.item_id = items.id
        WHERE items.category_id = ${categoryId} ORDER BY items.created_at ASC`
    : await db()`
        SELECT items.*, COALESCE(fc.cnt, 0) AS file_count FROM items
        LEFT JOIN (SELECT item_id, COUNT(*)::int AS cnt FROM item_files GROUP BY item_id) fc ON fc.item_id = items.id
        ORDER BY items.created_at ASC`;
  return rows.map(rowToItem);
}
async function getItemById(id) {
  const rows = await db()`
    SELECT items.*, COALESCE(fc.cnt, 0) AS file_count FROM items
    LEFT JOIN (SELECT item_id, COUNT(*)::int AS cnt FROM item_files GROUP BY item_id) fc ON fc.item_id = items.id
    WHERE items.id = ${id}`;
  return rows[0] ? rowToItem(rows[0]) : null;
}
async function insertItem(item) {
  await db()`
    INSERT INTO items (
      id, category_id, subcategory, name, manufacturer, sku, unit, pricing_mode,
      price_sheet, height_m, width_m, thickness_mm, cost, markup_percent, retail_override,
      stock_qty, notes, image_url, photos, articles, links, price_history, created_at, updated_at
    ) VALUES (
      ${item.id}, ${item.categoryId}, ${item.subcategory}, ${item.name}, ${item.manufacturer},
      ${item.sku}, ${item.unit}, ${item.pricingMode}, ${item.priceSheet}, ${item.heightM},
      ${item.widthM}, ${item.thicknessMm}, ${item.cost}, ${item.markupPercent}, ${item.retailOverride},
      ${item.stockQty}, ${item.notes}, ${item.imageUrl}, ${JSON.stringify(item.photos || [])},
      ${JSON.stringify(item.articles)},
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
      photos = ${JSON.stringify(merged.photos || [])},
      articles = ${JSON.stringify(merged.articles)}, links = ${JSON.stringify(merged.links)},
      price_history = ${JSON.stringify(merged.priceHistory)}, updated_at = ${merged.updatedAt}
    WHERE id = ${id}`;
  return merged;
}
async function deleteItemRow(id) {
  await db()`DELETE FROM items WHERE id = ${id}`;
}

// ---------- item files (документация) ----------
async function listItemFiles(itemId) {
  const rows = await db()`
    SELECT id, item_id, filename, mime_type, size, created_at FROM item_files
    WHERE item_id = ${itemId} ORDER BY created_at ASC`;
  return rows.map(rowToItemFileMeta);
}
async function getItemFileById(id) {
  const rows = await db()`SELECT * FROM item_files WHERE id = ${id}`;
  if (!rows[0]) return null;
  return { ...rowToItemFileMeta(rows[0]), dataBase64: rows[0].data_base64 };
}
async function insertItemFile(file) {
  await db()`
    INSERT INTO item_files (id, item_id, filename, mime_type, size, data_base64, created_at)
    VALUES (${file.id}, ${file.itemId}, ${file.filename}, ${file.mimeType}, ${file.size},
            ${file.dataBase64}, ${file.createdAt})`;
  return file;
}
async function deleteItemFileRow(id) {
  await db()`DELETE FROM item_files WHERE id = ${id}`;
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

// ---------- service categories ----------
async function listServiceCategories() {
  const rows = await db()`SELECT * FROM service_categories ORDER BY sort_order ASC`;
  return rows.map(rowToServiceCategory);
}
async function insertServiceCategory(cat) {
  await db()`
    INSERT INTO service_categories (id, name, icon, sort_order, created_at)
    VALUES (${cat.id}, ${cat.name}, ${cat.icon}, ${cat.sortOrder}, ${cat.createdAt})`;
  return cat;
}
async function updateServiceCategoryRow(id, patch) {
  const rows = await db()`SELECT * FROM service_categories WHERE id = ${id}`;
  if (!rows[0]) return null;
  const merged = { ...rowToServiceCategory(rows[0]), ...patch, id };
  await db()`
    UPDATE service_categories SET name = ${merged.name}, icon = ${merged.icon}, sort_order = ${merged.sortOrder}
    WHERE id = ${id}`;
  return merged;
}
async function deleteServiceCategoryRow(id) {
  await db()`DELETE FROM service_categories WHERE id = ${id}`;
}

// ---------- services ----------
async function listServices({ categoryId } = {}) {
  const rows = categoryId
    ? await db()`SELECT * FROM services WHERE category_id = ${categoryId} ORDER BY sort_order ASC`
    : await db()`SELECT * FROM services ORDER BY sort_order ASC`;
  return rows.map(rowToService);
}
async function getServiceById(id) {
  const rows = await db()`SELECT * FROM services WHERE id = ${id}`;
  return rows[0] ? rowToService(rows[0]) : null;
}
async function insertService(svc) {
  await db()`
    INSERT INTO services (id, category_id, name, unit, price_type, price, note, sort_order, created_at, updated_at)
    VALUES (${svc.id}, ${svc.categoryId}, ${svc.name}, ${svc.unit}, ${svc.priceType}, ${svc.price},
            ${svc.note}, ${svc.sortOrder}, ${svc.createdAt}, ${svc.updatedAt})`;
  return svc;
}
async function updateServiceRow(id, patch) {
  const existing = await getServiceById(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, id };
  await db()`
    UPDATE services SET
      category_id = ${merged.categoryId}, name = ${merged.name}, unit = ${merged.unit},
      price_type = ${merged.priceType}, price = ${merged.price}, note = ${merged.note},
      sort_order = ${merged.sortOrder}, updated_at = ${merged.updatedAt}
    WHERE id = ${id}`;
  return merged;
}
async function deleteServiceRow(id) {
  await db()`DELETE FROM services WHERE id = ${id}`;
}

// ---------- proposals (ТЗ) ----------
async function listProposals() {
  const rows = await db()`SELECT * FROM proposals ORDER BY created_at DESC`;
  return rows.map(rowToProposal);
}
async function getProposalById(id) {
  const rows = await db()`SELECT * FROM proposals WHERE id = ${id}`;
  return rows[0] ? rowToProposal(rows[0]) : null;
}
async function getProposalByShareToken(token) {
  const rows = await db()`SELECT * FROM proposals WHERE share_token = ${token}`;
  return rows[0] ? rowToProposal(rows[0]) : null;
}
async function insertProposal(p) {
  await db()`
    INSERT INTO proposals (
      id, share_token, title, client_name, client_phone, object_address, installer_name,
      installer_phone, project_amount, notes, status, items, total_amount, created_by, created_at, updated_at
    ) VALUES (
      ${p.id}, ${p.shareToken}, ${p.title}, ${p.clientName}, ${p.clientPhone}, ${p.objectAddress},
      ${p.installerName}, ${p.installerPhone}, ${p.projectAmount}, ${p.notes}, ${p.status},
      ${JSON.stringify(p.items)}, ${p.totalAmount}, ${p.createdBy}, ${p.createdAt}, ${p.updatedAt}
    )`;
  return p;
}
async function updateProposalRow(id, patch) {
  const existing = await getProposalById(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, id };
  await db()`
    UPDATE proposals SET
      title = ${merged.title}, client_name = ${merged.clientName}, client_phone = ${merged.clientPhone},
      object_address = ${merged.objectAddress}, installer_name = ${merged.installerName},
      installer_phone = ${merged.installerPhone}, project_amount = ${merged.projectAmount},
      notes = ${merged.notes}, status = ${merged.status}, items = ${JSON.stringify(merged.items)},
      total_amount = ${merged.totalAmount}, updated_at = ${merged.updatedAt}
    WHERE id = ${id}`;
  return merged;
}
async function deleteProposalRow(id) {
  await db()`DELETE FROM proposals WHERE id = ${id}`; // proposal_files уйдут по ON DELETE CASCADE
}

// ---------- proposal files ----------
async function listProposalFiles(proposalId) {
  const rows = await db()`
    SELECT id, proposal_id, filename, mime_type, size, created_at FROM proposal_files
    WHERE proposal_id = ${proposalId} ORDER BY created_at ASC`;
  return rows.map(rowToProposalFileMeta);
}
async function getProposalFileById(id) {
  const rows = await db()`SELECT * FROM proposal_files WHERE id = ${id}`;
  if (!rows[0]) return null;
  return { ...rowToProposalFileMeta(rows[0]), dataBase64: rows[0].data_base64 };
}
async function insertProposalFile(file) {
  await db()`
    INSERT INTO proposal_files (id, proposal_id, filename, mime_type, size, data_base64, created_at)
    VALUES (${file.id}, ${file.proposalId}, ${file.filename}, ${file.mimeType}, ${file.size},
            ${file.dataBase64}, ${file.createdAt})`;
  return file;
}
async function deleteProposalFileRow(id) {
  await db()`DELETE FROM proposal_files WHERE id = ${id}`;
}

module.exports = {
  getSettings, setSettings,
  listCategories, insertCategory, updateCategoryRow, deleteCategoryRow,
  listCategoryGroups, insertCategoryGroup, updateCategoryGroupRow, deleteCategoryGroupRow,
  listItems, getItemById, insertItem, updateItemRow, deleteItemRow,
  listItemFiles, getItemFileById, insertItemFile, deleteItemFileRow,
  listActivity, insertActivity,
  listServiceCategories, insertServiceCategory, updateServiceCategoryRow, deleteServiceCategoryRow,
  listServices, getServiceById, insertService, updateServiceRow, deleteServiceRow,
  listProposals, getProposalById, getProposalByShareToken, insertProposal, updateProposalRow, deleteProposalRow,
  listProposalFiles, getProposalFileById, insertProposalFile, deleteProposalFileRow,
};
