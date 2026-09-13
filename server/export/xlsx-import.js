const ExcelJS = require('exceljs');
const repo = require('../data/repo');

// Сопоставление заголовков колонок (много вариантов написания, т.к. реальные
// прайсы поставщиков называют колонки по-разному) -> внутреннее поле.
const HEADER_ALIASES = {
  name: ['название', 'наименование', 'name'],
  subcategory: ['подкатегория', 'группа', 'коллекция'],
  manufacturer: ['производитель', 'бренд', 'manufacturer', 'brand'],
  priceSheet: ['цена плиты', 'цена листа', 'price'],
  heightM: ['высота', 'высота, м', 'height'],
  widthM: ['ширина', 'ширина, м', 'width'],
  thicknessMm: ['толщина', 'толщина, мм'],
  cost: ['себестоимость', 'себес', 'себес за кв м', 'cost'],
  retail: ['розничная цена', 'цена клиенту', 'стоимость клиенту', 'retail'],
  sku: ['артикул', 'арт.', 'sku', 'арт. ltb'],
  unit: ['ед.', 'единица', 'unit'],
  stockQty: ['остаток', 'кол-во', 'qty'],
  notes: ['примечания', 'notes', 'комментарий'],
  link: ['ссылка', 'ссылки', 'ссылка на источник', 'link', 'ссылка на ltb'],
  link2: ['ссылка на blum', 'вторая ссылка'],
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildHeaderMap(headerRow) {
  const map = {}; // colIndex -> field
  headerRow.eachCell((cell, colNumber) => {
    const norm = normalizeHeader(cell.value);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => norm === a || norm.startsWith(a))) {
        map[colNumber] = field;
        break;
      }
    }
  });
  return map;
}

function cellText(cell) {
  if (cell == null) return '';
  if (cell.text != null) return String(cell.text).trim();
  return String(cell).trim();
}

function cellNumber(cell) {
  const v = cell && cell.value != null ? cell.value : cell;
  const n = typeof v === 'object' && v && 'result' in v ? v.result : v;
  const parsed = parseFloat(String(n).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

async function importWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const existingCategories = await repo.listCategories();
  const byName = new Map(existingCategories.map((c) => [c.name.trim().toLowerCase(), c]));

  let sheetsProcessed = 0;
  let itemsCreated = 0;
  let itemsSkipped = 0;

  for (const ws of wb.worksheets) {
    const headerRow = ws.getRow(1);
    if (!headerRow || headerRow.cellCount === 0) continue;
    const headerMap = buildHeaderMap(headerRow);
    if (Object.keys(headerMap).length === 0) continue; // не похоже на таблицу

    const hasSheetDims = Object.values(headerMap).includes('heightM') && Object.values(headerMap).includes('widthM');
    const pricingMode = hasSheetDims ? 'sheet' : 'direct';

    let category = byName.get(ws.name.trim().toLowerCase());
    if (!category) {
      category = await repo.createCategory({ name: ws.name, pricingMode, unit: pricingMode === 'sheet' ? 'м²' : 'шт' });
      byName.set(ws.name.trim().toLowerCase(), category);
    }

    sheetsProcessed += 1;
    let currentSubcategory = '';
    const pendingItems = []; // собираем синхронно, вставляем в хранилище по очереди ниже

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const fields = {};
      row.eachCell((cell, colNumber) => {
        const field = headerMap[colNumber];
        if (!field) return;
        fields[field] = cell;
      });

      const nameCell = fields.name;
      const name = nameCell ? cellText(nameCell) : '';
      const hasAnyPrice = fields.priceSheet || fields.cost || fields.retail;

      if (name && !hasAnyPrice) {
        // Строка-разделитель вида "ОДНОТОННЫЙ" / "TSS Cleaf / ЛДСП" — трактуем как подкатегорию.
        currentSubcategory = name;
        return;
      }
      if (!name) { itemsSkipped += 1; return; }

      const links = [];
      if (fields.link) {
        const url = cellText(fields.link);
        if (/^https?:\/\//i.test(url)) links.push({ id: cryptoRandomId(), url, autoParse: true, status: 'pending' });
      }
      if (fields.link2) {
        const url = cellText(fields.link2);
        if (/^https?:\/\//i.test(url)) links.push({ id: cryptoRandomId(), url, autoParse: true, status: 'pending' });
      }

      const item = {
        categoryId: category.id,
        subcategory: currentSubcategory,
        name,
        manufacturer: fields.manufacturer ? cellText(fields.manufacturer) : '',
        sku: fields.sku ? cellText(fields.sku) : '',
        unit: fields.unit ? cellText(fields.unit) : (pricingMode === 'sheet' ? 'м²' : 'шт'),
        pricingMode,
        priceSheet: fields.priceSheet ? cellNumber(fields.priceSheet) : null,
        heightM: fields.heightM ? cellNumber(fields.heightM) : null,
        widthM: fields.widthM ? cellNumber(fields.widthM) : null,
        thicknessMm: fields.thicknessMm ? cellNumber(fields.thicknessMm) : null,
        cost: fields.cost ? cellNumber(fields.cost) : 0,
        retailOverride: fields.retail ? cellNumber(fields.retail) : null,
        stockQty: fields.stockQty ? cellNumber(fields.stockQty) : null,
        notes: fields.notes ? cellText(fields.notes) : '',
        links,
      };

      pendingItems.push(item);
    });

    for (const item of pendingItems) {
      await repo.createItem(item);
      itemsCreated += 1;
    }
  }

  return { sheetsProcessed, itemsCreated, itemsSkipped };
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

module.exports = { importWorkbook };
