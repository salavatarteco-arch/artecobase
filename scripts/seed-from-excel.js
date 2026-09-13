// Разовый скрипт переноса данных из исходного файла
// "ARTECO прайс лист.xlsx" в новое приложение.
// Запуск: npm run seed  (или node scripts/seed-from-excel.js [путь_к_файлу])

const path = require('path');
const ExcelJS = require('exceljs');
const repo = require('../server/data/repo');

const SOURCE_FILE = process.argv[2] || path.join(__dirname, '..', 'ARTECO прайс лист.xlsx');

// Плитные материалы: A Название | B Цена плиты | C Высота | D Ширина | ... | J Ссылка
const BOARD_SHEETS = [
  { sheet: 'ЛДСП EGGER', icon: '🌳' },
  { sheet: 'МДФ TSS Cleaf', icon: '🎨' },
  { sheet: 'МДФ ARKOPA', icon: '✨' },
  { sheet: 'ЛДСП Smart', icon: '🟫' },
  { sheet: 'МДФ PLATA', icon: '🪵' },
  { sheet: 'ЛДСП KRONOSPAN', icon: '🌲' },
  { sheet: 'МДФ AGT ', icon: '🎯', displayName: 'МДФ AGT' },
  { sheet: 'ХДФ 2,5 мм', icon: '📄' },
  { sheet: 'СТОЛЕШНИЦЫ', icon: '🪑' },
];

function cellVal(row, col) {
  const c = row.getCell(col);
  let v = c.value;
  if (v == null) return null;
  if (typeof v === 'object' && 'result' in v) return v.result; // формула
  // Ячейка-гиперссылка оборачивает реальное значение в .text — которое само
  // может быть строкой ИЛИ ещё одним rich-text объектом (разноцветный текст
  // внутри ссылки, как в "Петли Blum").
  if (typeof v === 'object' && v && 'hyperlink' in v) v = v.text;
  if (typeof v === 'object' && v && v.richText) return v.richText.map((t) => t.text).join('');
  if (typeof v === 'object' && v && typeof v.text === 'string') return v.text;
  return v;
}
function num(v) {
  if (v == null || v === '') return null; // Number('') === 0, поэтому проверяем явно
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v) { return v == null ? '' : String(v).trim(); }

async function importBoardSheet(wb, def) {
  const ws = wb.getWorksheet(def.sheet);
  if (!ws) { console.warn(`  ! лист "${def.sheet}" не найден — пропуск`); return; }

  const category = await repo.createCategory({
    name: def.displayName || def.sheet.trim(),
    pricingMode: 'sheet',
    unit: 'м²',
    icon: def.icon,
  });

  let subcategory = '';
  let created = 0;
  const isCountertop = def.sheet === 'СТОЛЕШНИЦЫ';
  const pending = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // заголовок
    const name = str(cellVal(row, 'A'));
    const priceSheet = num(cellVal(row, 'B'));
    // У листа "СТОЛЕШНИЦЫ" размеры сдвинуты на столбец (лишняя колонка C).
    const heightM = isCountertop ? num(cellVal(row, 'D')) : num(cellVal(row, 'C'));
    const widthM = isCountertop ? num(cellVal(row, 'E')) : num(cellVal(row, 'D'));
    const link = str(cellVal(row, 'J'));

    if (!name) return;
    if (priceSheet == null && heightM == null && widthM == null) {
      subcategory = name; // строка-разделитель, например "ОДНОТОННЫЙ" / "TSS Cleaf / ЛДСП"
      return;
    }

    pending.push({
      categoryId: category.id,
      subcategory,
      name,
      pricingMode: 'sheet',
      unit: 'м²',
      priceSheet,
      heightM,
      widthM,
      links: /^https?:\/\//i.test(link) ? [{ url: link, label: hostLabel(link), autoParse: true }] : [],
    });
  });

  for (const item of pending) {
    await repo.createItem(item);
    created += 1;
  }

  console.log(`  ✓ ${category.name}: ${created} позиций`);
}

function hostLabel(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h.includes('ltb.ge')) return 'LTB.ge';
    if (h.includes('kronospan')) return 'Kronospan (каталог)';
    if (h.includes('kasta.ge')) return 'Kasta.ge';
    return h;
  } catch { return ''; }
}

async function importHardwareSheet(wb, sheetName, catName, icon) {
  const ws = wb.getWorksheet(sheetName);
  if (!ws) { console.warn(`  ! лист "${sheetName}" не найден — пропуск`); return; }

  const category = await repo.createCategory({ name: catName, pricingMode: 'direct', unit: 'шт', icon });

  let subcategory = '';
  let created = 0;
  const pending = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = str(cellVal(row, 'A'));
    const artLtb = str(cellVal(row, 'B'));
    const artBlum = str(cellVal(row, 'C'));
    const cost = num(cellVal(row, 'D'));
    const retail = num(cellVal(row, 'E'));
    const linkLtb = str(cellVal(row, 'F'));
    const linkBlum = str(cellVal(row, 'G'));

    if (!name) return;
    if (cost == null && retail == null && !artLtb && !artBlum) {
      subcategory = name;
      return;
    }

    const articles = [];
    if (artLtb) articles.push({ label: 'LTB', value: artLtb });
    if (artBlum) articles.push({ label: 'Blum', value: artBlum });

    const links = [];
    if (/^https?:\/\//i.test(linkLtb)) links.push({ url: linkLtb, label: 'LTB.ge', autoParse: true });
    if (/^https?:\/\//i.test(linkBlum)) links.push({ url: linkBlum, label: 'Blum', autoParse: true });

    pending.push({
      categoryId: category.id,
      subcategory,
      name,
      pricingMode: 'direct',
      unit: 'шт',
      cost: cost ?? 0,
      retailOverride: retail ?? null,
      articles,
      links,
    });
  });

  for (const item of pending) {
    await repo.createItem(item);
    created += 1;
  }

  console.log(`  ✓ ${category.name}: ${created} позиций`);
}

async function main() {
  console.log(`Читаю файл: ${SOURCE_FILE}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SOURCE_FILE);

  console.log('\nПереношу плитные материалы:');
  for (const def of BOARD_SHEETS) {
    await importBoardSheet(wb, def);
  }

  console.log('\nПереношу фурнитуру:');
  await importHardwareSheet(wb, 'Петли Blum', 'Петли Blum', '🔩');
  await importHardwareSheet(wb, 'Направляющие Blum', 'Направляющие Blum', '📏');
  await importHardwareSheet(wb, 'Навесы', 'Навесы', '🪝');

  console.log('\nГотово.');
}

main().catch((err) => { console.error(err); process.exit(1); });
