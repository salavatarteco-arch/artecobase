const ExcelJS = require('exceljs');
const repo = require('../data/repo');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2118' } };
const HEADER_FONT = { color: { argb: 'FFF5EFE6' }, bold: true };

function safeSheetName(name) {
  return name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Лист';
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'АРТЕКО — прайс-лист';
  wb.created = new Date();

  const settings = await repo.getSettings();
  const categories = await repo.listCategories();

  for (const cat of categories) {
    const ws = wb.addWorksheet(safeSheetName(cat.name));
    const isSheetMode = cat.pricingMode === 'sheet';

    const columns = isSheetMode
      ? [
          { header: 'Название', key: 'name', width: 40 },
          { header: 'Подкатегория', key: 'subcategory', width: 18 },
          { header: 'Производитель', key: 'manufacturer', width: 16 },
          { header: 'Цена плиты', key: 'priceSheet', width: 12 },
          { header: 'Высота, м', key: 'heightM', width: 10 },
          { header: 'Ширина, м', key: 'widthM', width: 10 },
          { header: 'Площадь листа, м²', key: 'area', width: 14 },
          { header: `Себестоимость, ${settings.currencySymbol}/м²`, key: 'costPerUnit', width: 16 },
          { header: `Цена клиенту, ${settings.currencySymbol}/м²`, key: 'retailPrice', width: 16 },
          { header: 'Толщина, мм', key: 'thicknessMm', width: 10 },
          { header: 'Артикул', key: 'sku', width: 14 },
          { header: 'Ссылка на источник', key: 'link', width: 45 },
          { header: 'Обновлено', key: 'updatedAt', width: 18 },
          { header: 'Примечания', key: 'notes', width: 25 },
        ]
      : [
          { header: 'Название', key: 'name', width: 45 },
          { header: 'Подкатегория', key: 'subcategory', width: 18 },
          { header: 'Производитель', key: 'manufacturer', width: 16 },
          { header: 'Ед.', key: 'unit', width: 8 },
          { header: 'Артикул', key: 'sku', width: 16 },
          { header: `Себестоимость, ${settings.currencySymbol}`, key: 'costPerUnit', width: 16 },
          { header: `Розничная цена, ${settings.currencySymbol}`, key: 'retailPrice', width: 16 },
          { header: 'Остаток', key: 'stockQty', width: 10 },
          { header: 'Ссылки', key: 'link', width: 50 },
          { header: 'Обновлено', key: 'updatedAt', width: 18 },
          { header: 'Примечания', key: 'notes', width: 25 },
        ];

    ws.columns = columns;
    ws.getRow(1).eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
    });
    const updatedCol = ws.getColumn('updatedAt');
    if (updatedCol) updatedCol.numFmt = 'dd.mm.yyyy hh:mm';
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    const items = await repo.listItems({ categoryId: cat.id });
    for (const item of items) {
      const linkText = (item.links || []).map((l) => l.url).join('\n');
      ws.addRow({
        name: item.name,
        subcategory: item.subcategory,
        manufacturer: item.manufacturer,
        unit: item.unit,
        sku: item.sku,
        priceSheet: item.priceSheet,
        heightM: item.heightM,
        widthM: item.widthM,
        area: item.area,
        costPerUnit: item.costPerUnit,
        retailPrice: item.retailPrice,
        thicknessMm: item.thicknessMm,
        stockQty: item.stockQty,
        link: linkText,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : null,
        notes: item.notes,
      });
    }
  }

  if (categories.length === 0) {
    wb.addWorksheet('Прайс-лист').addRow(['Категорий пока нет — добавьте их в приложении.']);
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { buildWorkbook };
