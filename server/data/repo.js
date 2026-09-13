const { nanoid } = require('nanoid');

// Выбор хранилища: если задан DATABASE_URL (деплой на Vercel + Neon) — Postgres,
// иначе локальные JSON-файлы (обычный запуск .bat в офисе, без интернета).
const driver = process.env.DATABASE_URL
  ? require('./driver-postgres')
  : require('./driver-file');

const DEFAULT_SETTINGS = {
  companyName: 'АРТЕКО',
  currency: 'GEL',
  currencySymbol: '₾',
  defaultMarkupPercent: 200, // наценка по умолчанию: себестоимость * 3 = цена клиенту
  autoParseIntervalHours: 0, // 0 = выключено, иначе фоновое обновление раз в N часов
};

function now() {
  return new Date().toISOString();
}

// ---------- Settings ----------
async function getSettings() {
  const stored = await driver.getSettings();
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}
async function updateSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await driver.setSettings(next);
  return next;
}

// ---------- Categories ----------
// pricingMode: 'sheet' (плитный материал, цена за м² считается из размеров листа)
//            | 'direct' (штучная фурнитура: себестоимость/розница вводятся напрямую)
async function listCategories() {
  return driver.listCategories();
}

async function createCategory({ name, pricingMode = 'direct', unit = 'шт', icon = '', sortOrder }) {
  const list = await driver.listCategories();
  const cat = {
    id: nanoid(10),
    name,
    pricingMode,
    unit,
    icon,
    sortOrder: sortOrder ?? list.length,
    createdAt: now(),
  };
  await driver.insertCategory(cat);
  return cat;
}

async function updateCategory(id, patch) {
  return driver.updateCategoryRow(id, patch);
}

async function deleteCategory(id) {
  await driver.deleteCategoryRow(id);
  // Осиротевшие товары не удаляем, но помечаем — можно показать в "Без категории".
}

// ---------- Pricing helpers (чистые функции, без обращения к хранилищу) ----------
function computePricing(item, settings) {
  const markup = item.markupPercent ?? settings.defaultMarkupPercent;
  let costPerUnit = item.cost ?? 0;
  let area = null;

  if (item.pricingMode === 'sheet') {
    const h = Number(item.heightM) || 0;
    const w = Number(item.widthM) || 0;
    area = h && w ? +(h * w).toFixed(4) : 0;
    const boardPrice = Number(item.priceSheet) || 0;
    costPerUnit = area > 0 ? boardPrice / area : 0;
  }

  const retail = item.retailOverride != null
    ? Number(item.retailOverride)
    : +(costPerUnit * (1 + markup / 100)).toFixed(2);

  return {
    area,
    costPerUnit: +costPerUnit.toFixed(4),
    retailPrice: retail,
  };
}

function decorateItem(item, settings) {
  const pricing = computePricing(item, settings);
  return { ...item, ...pricing };
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return links;
  return links.map((l) => ({
    id: l.id || nanoid(8),
    url: l.url || '',
    label: l.label || '',
    autoParse: l.autoParse !== false,
    lastPrice: l.lastPrice ?? null,
    lastCurrency: l.lastCurrency ?? null,
    lastParsedAt: l.lastParsedAt ?? null,
    status: l.status || 'pending',
    statusMessage: l.statusMessage || '',
    confidence: l.confidence ?? null,
  }));
}

// ---------- Items ----------
async function listItems({ categoryId } = {}) {
  const settings = await getSettings();
  const list = await driver.listItems({ categoryId });
  return list.map((i) => decorateItem(i, settings));
}

async function getItem(id) {
  const settings = await getSettings();
  const item = await driver.getItemById(id);
  return item ? decorateItem(item, settings) : null;
}

async function createItem(data) {
  const item = {
    id: nanoid(10),
    categoryId: data.categoryId || null,
    subcategory: data.subcategory || '',
    name: data.name || 'Новая позиция',
    manufacturer: data.manufacturer || '',
    sku: data.sku || '',
    unit: data.unit || 'шт',
    pricingMode: data.pricingMode || 'direct', // 'sheet' | 'direct'
    priceSheet: data.priceSheet ?? null,
    heightM: data.heightM ?? null,
    widthM: data.widthM ?? null,
    thicknessMm: data.thicknessMm ?? null,
    cost: data.cost ?? 0,
    markupPercent: data.markupPercent ?? null, // null => берём дефолт из settings
    retailOverride: data.retailOverride ?? null,
    stockQty: data.stockQty ?? null,
    notes: data.notes || '',
    imageUrl: data.imageUrl || '',
    articles: data.articles || [], // [{label:'LTB', value:'000020833'}]
    links: normalizeLinks(data.links || []), // [{id,url,label,domain,autoParse,lastPrice,lastParsedAt,status,statusMessage}]
    createdAt: now(),
    updatedAt: now(),
    priceHistory: [],
  };
  await driver.insertItem(item);
  return getItem(item.id);
}

async function updateItem(id, patch) {
  const prev = await driver.getItemById(id);
  if (!prev) return null;

  if (patch.links) patch = { ...patch, links: normalizeLinks(patch.links) };
  const merged = { ...prev, ...patch, id, updatedAt: now() };

  // Если меняется себестоимость/цена плиты — пишем в историю цен.
  const settings = await getSettings();
  const prevPricing = computePricing(prev, settings);
  const nextPricing = computePricing(merged, settings);
  if (Math.abs((prevPricing.costPerUnit || 0) - (nextPricing.costPerUnit || 0)) > 0.0001) {
    merged.priceHistory = [
      ...(prev.priceHistory || []),
      { date: now(), cost: nextPricing.costPerUnit, retail: nextPricing.retailPrice, source: patch.__priceSource || 'manual' },
    ].slice(-50);
  }
  delete merged.__priceSource;

  await driver.updateItemRow(id, merged);
  return getItem(id);
}

async function deleteItem(id) {
  await driver.deleteItemRow(id);
}

async function duplicateItem(id) {
  const src = await driver.getItemById(id);
  if (!src) return null;
  const copy = { ...src, id: nanoid(10), name: `${src.name} (копия)`, createdAt: now(), updatedAt: now() };
  await driver.insertItem(copy);
  return getItem(copy.id);
}

// ---------- Links / price updates ----------
async function applyParsedPrice(itemId, linkId, result) {
  const item = await driver.getItemById(itemId);
  if (!item) return null;
  const links = (item.links || []).map((l) => {
    if (l.id !== linkId) return l;
    return {
      ...l,
      lastPrice: result.price ?? l.lastPrice,
      lastCurrency: result.currency ?? l.lastCurrency,
      lastParsedAt: now(),
      status: result.status,
      statusMessage: result.message || '',
      confidence: result.confidence || null,
    };
  });

  let patch = { links };
  // Если удалось распарсить цену и это "плитный" материал — обновляем priceSheet,
  // иначе (штучная фурнитура) обновляем cost.
  if (result.status === 'ok' && typeof result.price === 'number') {
    patch.__priceSource = `link:${linkId}`;
    if (item.pricingMode === 'sheet') {
      patch.priceSheet = result.price;
    } else {
      patch.cost = result.price;
    }
  }

  const updated = await updateItem(itemId, patch);
  await logActivity({
    itemId,
    itemName: item.name,
    linkId,
    status: result.status,
    message: result.message || '',
    price: result.price ?? null,
  });
  return updated;
}

async function logActivity(entry) {
  await driver.insertActivity({ id: nanoid(8), at: now(), ...entry });
}

async function listActivity(limit = 100) {
  return driver.listActivity(limit);
}

module.exports = {
  getSettings,
  updateSettings,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  duplicateItem,
  applyParsedPrice,
  listActivity,
  computePricing,
};
