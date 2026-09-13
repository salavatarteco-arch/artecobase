// Переносит текущие локальные данные (server/data/db/*.json) в Postgres.
// Выполняется один раз, локально, ПОСЛЕ того как создана база (Neon) и
// применена схема (server/data/schema.sql).
//
// Запуск:
//   DATABASE_URL="postgres://..." node scripts/migrate-to-postgres.js
//
// На Windows (PowerShell):
//   $env:DATABASE_URL="postgres://..."; node scripts/migrate-to-postgres.js

const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('Ошибка: задайте переменную DATABASE_URL (строка подключения к Neon/Postgres).');
  console.error('Пример: DATABASE_URL="postgres://user:pass@host/db" node scripts/migrate-to-postgres.js');
  process.exit(1);
}

const driver = require('../server/data/driver-postgres');

const DB_DIR = path.join(__dirname, '..', 'server', 'data', 'db');

function readJson(name, fallback) {
  const p = path.join(DB_DIR, `${name}.json`);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

async function main() {
  const settings = readJson('settings', null);
  const categories = readJson('categories', []);
  const items = readJson('items', []);
  const activity = readJson('activity', []);

  console.log(`Найдено локально: ${categories.length} категорий, ${items.length} позиций, ${activity.length} записей журнала.`);

  if (settings) {
    console.log('Переношу настройки…');
    const current = await driver.getSettings();
    await driver.setSettings({ ...current, ...settings });
  }

  console.log('Переношу категории…');
  for (const cat of categories) {
    await driver.insertCategory(cat);
  }

  console.log('Переношу позиции…');
  let done = 0;
  for (const item of items) {
    await driver.insertItem({ ...item, priceHistory: item.priceHistory || [] });
    done += 1;
    if (done % 25 === 0) console.log(`  … ${done}/${items.length}`);
  }

  console.log('Переношу журнал обновлений…');
  for (const entry of activity) {
    await driver.insertActivity(entry);
  }

  console.log('\nГотово. Проверьте приложение, подключённое к этой базе.');
}

main().catch((err) => {
  console.error('Ошибка миграции:', err);
  process.exit(1);
});
