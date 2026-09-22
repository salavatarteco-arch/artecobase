// Прайс услуг для монтажников + генератор ТЗ (технических заданий по монтажу).
// Отдельный домен от материалов/фурнитуры (server/data/repo.js): здесь не
// товары, а работы — свои категории, своя валюта (по умолчанию ₾), и
// поверх прайса — сохранённые расчёты (proposals), которые менеджер
// собирает перед монтажом и отправляет монтажнику по ссылке.

const { nanoid } = require('nanoid');
const repo = require('./repo');

const driver = process.env.DATABASE_URL
  ? require('./driver-postgres')
  : require('./driver-file');

function now() {
  return new Date().toISOString();
}

// ---------- базовый прайс (перенесён из PDF-прайса услуг АРТЕКО) ----------
// price_type: 'fixed' — фиксированная цена за ед.; 'from' — цена "от",
// можно увеличить при добавлении в ТЗ; 'percent' — % от суммы, которую
// менеджер укажет при добавлении строки; 'custom' — договорная, цена
// вводится вручную.
const SEED_CATEGORIES = [
  { name: 'Базовые услуги', icon: 'clipboard', services: [
    { name: 'Сборка кухонь Базовая (для кухонь свыше 180 000 ₾)', unit: '%', priceType: 'percent', price: 13, note: 'От цены изделия, для кухонь дороже 180 000 ₾' },
    { name: 'Сборка кухонь Базовая (для кухонь до 180 000 ₾)', unit: 'каркас (шт.)', priceType: 'fixed', price: 1750 },
  ] },
  { name: 'Установка техники', icon: 'plug', services: [
    { name: 'Монтаж встраиваемой морозильной камеры / винотеки (с фасадом)', unit: 'шт', priceType: 'fixed', price: 1600 },
    { name: 'Монтаж смесителя / крана (с высверливанием) без подключения', unit: 'шт', priceType: 'fixed', price: 1000 },
    { name: 'Установка варочной поверхности (ламин. столешница, без подключения)', unit: 'шт', priceType: 'fixed', price: 1600 },
    { name: 'Подключение варочной панели к электричеству', unit: 'шт', priceType: 'fixed', price: 1500 },
    { name: 'Установка духового шкафа / СВЧ / кофемашины', unit: 'шт', priceType: 'fixed', price: 1600 },
    { name: 'Установка встраиваемого холодильника (с фасадами)', unit: 'шт', priceType: 'fixed', price: 2500 },
    { name: 'Установка посудомоечной / стиральной машины (с фасадом, без подключения)', unit: 'шт', priceType: 'fixed', price: 2000 },
    { name: 'Установка вытяжки каминного типа / встроенной', unit: 'шт', priceType: 'fixed', price: 2000 },
    { name: 'Установка измельчителя', unit: 'шт', priceType: 'fixed', price: 2000 },
    { name: 'Установка мойки (ламин. столешница, без подключения)', unit: 'шт', priceType: 'fixed', price: 2000 },
    { name: 'Подключение смесителя к коммуникациям', unit: 'шт', priceType: 'fixed', price: 800 },
    { name: 'Установка сливного оборудования (сифон)', unit: 'шт', priceType: 'fixed', price: 500 },
    { name: 'Установка фильтра воды с подключением', unit: 'шт', priceType: 'fixed', price: 1600 },
    { name: 'Установка / распаковка отдельно стоящей техники (без подключения)', unit: 'шт', priceType: 'fixed', price: 625 },
  ] },
  { name: 'Дополнительные работы по сборке', icon: 'wrench', services: [
    { name: 'Выпил в мебели под трубы / розетки / препятствия', unit: 'шт', priceType: 'fixed', price: 300 },
    { name: 'Выпил в стеновой панели под розетку', unit: 'шт', priceType: 'fixed', price: 300 },
    { name: 'Выпил в стеновой панели под тех. люк', unit: 'шт', priceType: 'fixed', price: 500 },
    { name: 'Демонтаж бытовой техники, мойки, смесителя', unit: 'шт', priceType: 'fixed', price: 500 },
    { name: 'Демонтаж элементов мебели (каркасы, столешницы, панели)', unit: 'каркас (шт.)', priceType: 'fixed', price: 500 },
    { name: 'Демонтаж / монтаж плинтуса', unit: 'шт', priceType: 'fixed', price: 200 },
    { name: 'Демонтаж / монтаж тех. люка', unit: 'шт', priceType: 'fixed', price: 500 },
    { name: 'Фрезеровка отверстия под петлю', unit: 'шт', priceType: 'fixed', price: 350 },
    { name: 'Изготовление элементов мебели из материала заказчика', unit: 'шт', priceType: 'fixed', price: 1000 },
    { name: 'Изменение конструкции (высота, ширина, глубина)', unit: 'шт', priceType: 'fixed', price: 2000 },
    { name: 'Изменение конструкции кухонного шкафа', unit: 'шт', priceType: 'fixed', price: 1000 },
    { name: 'Кромление столешницы', unit: 'м.пог.', priceType: 'fixed', price: 500 },
    { name: 'Монтаж закладных при кривизне стен > 4 мм', unit: 'м.пог.', priceType: 'fixed', price: 500 },
    { name: 'Перенавеска дверей холодильника', unit: 'шт', priceType: 'fixed', price: 1000 },
    { name: 'Пил декор панелей, установка, доборы', unit: 'шт', priceType: 'fixed', price: 500 },
    { name: 'Подгонка декор карниза багетного', unit: 'шт', priceType: 'fixed', price: 900 },
    { name: 'Присадка в каркасе под элементы', unit: 'шт', priceType: 'fixed', price: 100 },
    { name: 'Продольный / торцевой пил столешницы', unit: 'м.пог.', priceType: 'fixed', price: 500 },
    { name: 'Стыковка столешниц (евростык)', unit: 'шт', priceType: 'fixed', price: 8000 },
    { name: 'Установка и подключение скрытой подсветки / освещения', unit: 'м.пог.', priceType: 'fixed', price: 500 },
    { name: 'Установка и подключение светильников', unit: 'шт', priceType: 'fixed', price: 500 },
    { name: 'Установка карниза', unit: 'м.пог.', priceType: 'fixed', price: 350 },
    { name: 'Установка ручек (заказчика)', unit: 'шт', priceType: 'fixed', price: 100 },
    { name: 'Установка стенового бордюра', unit: 'м.пог.', priceType: 'fixed', price: 100 },
    { name: 'Установка стеновых панелей', unit: 'м.пог.', priceType: 'fixed', price: 500 },
    { name: 'Установка текстолитовой столешницы с подложкой', unit: 'шт', priceType: 'fixed', price: 1000 },
    { name: 'Фрезеровка фасада под накладную ручку', unit: 'шт', priceType: 'fixed', price: 250 },
    { name: 'Выпил под мойку или варочную панель (без установки)', unit: 'шт', priceType: 'fixed', price: 1000 },
  ] },
  { name: 'Строительно-монтажные работы', icon: 'bolt', services: [
    { name: 'Демонтаж розетки, клем, выключателя', unit: 'шт', priceType: 'fixed', price: 250 },
    { name: 'Доработка канализации', unit: 'шт', priceType: 'fixed', price: 200 },
    { name: 'Монтаж вентиляционного канала', unit: 'м.пог.', priceType: 'fixed', price: 1000 },
    { name: 'Монтаж выдвижного блока розеток', unit: 'шт', priceType: 'fixed', price: 1000 },
    { name: 'Монтаж розетки, клем, выключателя', unit: 'шт', priceType: 'fixed', price: 350 },
    { name: 'Монтаж скрытой электропроводки (штробление)', unit: 'м.пог.', priceType: 'fixed', price: 1000 },
    { name: 'Удлинение выводов воды', unit: 'ед.', priceType: 'fixed', price: 400 },
    { name: 'Установка крана / вентиля / ниппеля / переходника', unit: 'шт', priceType: 'fixed', price: 350 },
    { name: 'Доп. работы, не включённые в прайс', unit: 'нормо-час', priceType: 'fixed', price: 500 },
    { name: 'Замер помещения', unit: 'шт', priceType: 'fixed', price: 2000 },
    { name: 'Минимальная цена сборки (ложный вызов)', unit: 'шт', priceType: 'fixed', price: 2500 },
    { name: 'Простой не по вине сборочной компании (подъём/спуск без лифта)', unit: 'нормо-час', priceType: 'fixed', price: 500 },
    { name: 'Расходные материалы', unit: '₾', priceType: 'fixed', price: 1, note: 'В количестве укажите сумму расходных материалов' },
    { name: 'Удалённый выезд (за пределами города)', unit: 'км', priceType: 'fixed', price: 40 },
  ] },
  { name: 'Корпусная мебель', icon: 'sofa', services: [
    { name: 'Комплекты мебели (столы, стулья) — минимально', unit: 'шт', priceType: 'from', price: 2500 },
    { name: 'Работы по сборке корпусной мебели (универсальная услуга)', unit: 'услуга', priceType: 'custom', price: null, note: 'Договорная — цена задаётся при добавлении в ТЗ' },
    { name: 'Сборка кровати без ПМ (одноуровневая)', unit: 'шт', priceType: 'from', price: 2500 },
    { name: 'Сборка кровати с ПМ (одноуровневая)', unit: 'шт', priceType: 'from', price: 3500 },
    { name: 'Сборка мебели стоимостью до 50 тыс. ₾', unit: '%', priceType: 'percent', price: 15 },
    { name: 'Сборка мебели стоимостью от 50 тыс. ₾ до 150 тыс. ₾', unit: '%', priceType: 'percent', price: 13 },
    { name: 'Сборка мебели стоимостью от 150 тыс. ₾', unit: '%', priceType: 'percent', price: 11 },
    { name: 'Надбавка за стеснённые условия (узкие проёмы и т.п.)', unit: '%', priceType: 'percent', price: 30, note: 'Надбавка — считается от суммы сборки этой же позиции' },
  ] },
];

async function ensureSeeded() {
  const settings = await repo.getSettings();
  if (settings.servicesSeeded) return;
  const existing = await driver.listServiceCategories();
  if (existing.length === 0) {
    let sortOrder = 0;
    for (const group of SEED_CATEGORIES) {
      const cat = {
        id: nanoid(10),
        name: group.name,
        icon: group.icon,
        sortOrder: sortOrder++,
        createdAt: now(),
      };
      await driver.insertServiceCategory(cat);
      let svcOrder = 0;
      for (const s of group.services) {
        await driver.insertService({
          id: nanoid(10),
          categoryId: cat.id,
          name: s.name,
          unit: s.unit,
          priceType: s.priceType,
          price: s.price ?? null,
          note: s.note || '',
          sortOrder: svcOrder++,
          createdAt: now(),
          updatedAt: now(),
        });
      }
    }
  }
  await repo.updateSettings({ servicesSeeded: true });
}

// ---------- Service categories ----------
async function listServiceCategories() {
  await ensureSeeded();
  return driver.listServiceCategories();
}
async function createServiceCategory({ name, icon = 'box', sortOrder }) {
  const list = await driver.listServiceCategories();
  const cat = { id: nanoid(10), name, icon, sortOrder: sortOrder ?? list.length, createdAt: now() };
  await driver.insertServiceCategory(cat);
  return cat;
}
async function updateServiceCategory(id, patch) {
  return driver.updateServiceCategoryRow(id, patch);
}
async function deleteServiceCategory(id) {
  await driver.deleteServiceCategoryRow(id);
}

// ---------- Services ----------
async function listServices({ categoryId } = {}) {
  await ensureSeeded();
  return driver.listServices({ categoryId });
}
async function getService(id) {
  return driver.getServiceById(id);
}
async function createService(data) {
  const svc = {
    id: nanoid(10),
    categoryId: data.categoryId || null,
    name: data.name || 'Новая услуга',
    unit: data.unit || 'шт',
    priceType: data.priceType || 'fixed', // fixed | from | percent | custom
    price: data.price ?? null,
    note: data.note || '',
    sortOrder: data.sortOrder ?? 0,
    createdAt: now(),
    updatedAt: now(),
  };
  await driver.insertService(svc);
  return svc;
}
async function updateService(id, patch) {
  const prev = await driver.getServiceById(id);
  if (!prev) return null;
  return driver.updateServiceRow(id, { ...patch, updatedAt: now() });
}
async function deleteService(id) {
  await driver.deleteServiceRow(id);
}

// ---------- Pricing helpers (чистые функции) ----------
// Строка ТЗ: { serviceId, name, unit, priceType, unitPrice, qty, percentBase, note }
// - fixed/from/custom: amount = unitPrice * qty
// - percent: amount = percentBase * unitPrice/100 * (qty || 1)
function computeLineAmount(line) {
  const unitPrice = Number(line.unitPrice) || 0;
  const qty = line.qty == null || line.qty === '' ? 1 : Number(line.qty) || 0;
  if (line.priceType === 'percent') {
    const base = Number(line.percentBase) || 0;
    return +(base * (unitPrice / 100) * qty).toFixed(2);
  }
  return +(unitPrice * qty).toFixed(2);
}
function decorateProposalItems(items) {
  return (items || []).map((it) => ({ ...it, amount: computeLineAmount(it) }));
}
function computeProposalTotal(items) {
  return +decorateProposalItems(items).reduce((s, it) => s + it.amount, 0).toFixed(2);
}
function decorateProposal(p) {
  if (!p) return p;
  const items = decorateProposalItems(p.items);
  return { ...p, items, totalAmount: computeProposalTotal(p.items), number: proposalNumber(p.id, p.createdAt) };
}

// ---------- Proposals (ТЗ) ----------
async function listProposals() {
  const list = await driver.listProposals();
  return list
    .map(decorateProposal)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
async function getProposal(id) {
  const p = await driver.getProposalById(id);
  return p ? decorateProposal(p) : null;
}
async function getProposalByShareToken(token) {
  const p = await driver.getProposalByShareToken(token);
  return p ? decorateProposal(p) : null;
}
function proposalNumber(id, createdAt) {
  const d = new Date(createdAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ТЗ-${ymd}-${id.slice(0, 4).toUpperCase()}`;
}
async function createProposal(data) {
  const id = nanoid(10);
  const createdAt = now();
  const p = {
    id,
    shareToken: nanoid(24),
    title: data.title || '',
    clientName: data.clientName || '',
    clientPhone: data.clientPhone || '',
    objectAddress: data.objectAddress || '',
    installerName: data.installerName || '',
    installerPhone: data.installerPhone || '',
    projectAmount: data.projectAmount ?? null,
    notes: data.notes || '',
    status: data.status || 'draft',
    items: Array.isArray(data.items) ? data.items : [],
    totalAmount: 0,
    createdBy: data.createdBy || '',
    createdAt,
    updatedAt: createdAt,
  };
  p.totalAmount = computeProposalTotal(p.items);
  await driver.insertProposal(p);
  return decorateProposal(p);
}
async function updateProposal(id, patch) {
  const prev = await driver.getProposalById(id);
  if (!prev) return null;
  const merged = { ...prev, ...patch, id, updatedAt: now() };
  merged.totalAmount = computeProposalTotal(merged.items);
  await driver.updateProposalRow(id, merged);
  return decorateProposal(merged);
}
async function deleteProposal(id) {
  await driver.deleteProposalRow(id);
}
async function duplicateProposal(id) {
  const src = await driver.getProposalById(id);
  if (!src) return null;
  return createProposal({ ...src, title: `${src.title} (копия)`, status: 'draft' });
}

// ---------- Proposal files ----------
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 МБ на файл — чертежи/эскизы, не видео

async function listProposalFiles(proposalId) {
  return driver.listProposalFiles(proposalId);
}
async function addProposalFile(proposalId, { filename, mimeType, buffer }) {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Файл слишком большой (${(buffer.length / 1024 / 1024).toFixed(1)} МБ) — максимум 15 МБ`);
  }
  const file = {
    id: nanoid(10),
    proposalId,
    filename: filename || 'файл',
    mimeType: mimeType || 'application/octet-stream',
    size: buffer.length,
    dataBase64: buffer.toString('base64'),
    createdAt: now(),
  };
  await driver.insertProposalFile(file);
  const { dataBase64, ...meta } = file;
  return meta;
}
async function getProposalFile(fileId) {
  return driver.getProposalFileById(fileId);
}
async function deleteProposalFile(fileId) {
  await driver.deleteProposalFileRow(fileId);
}

module.exports = {
  listServiceCategories, createServiceCategory, updateServiceCategory, deleteServiceCategory,
  listServices, getService, createService, updateService, deleteService,
  listProposals, getProposal, getProposalByShareToken, createProposal, updateProposal, deleteProposal, duplicateProposal,
  proposalNumber,
  listProposalFiles, addProposalFile, getProposalFile, deleteProposalFile,
  computeLineAmount, computeProposalTotal,
};
