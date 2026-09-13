// Драйвер хранения на локальных JSON-файлах — используется, когда не задан
// DATABASE_URL (обычный локальный запуск через .bat, без интернета/базы).
// Реализует тот же асинхронный интерфейс, что и driver-postgres.js, чтобы
// repo.js мог работать одинаково с обоими.

const { Collection } = require('./store-file');

const categories = new Collection('categories', []);
const items = new Collection('items', []);
const settingsCol = new Collection('settings', null);
const activity = new Collection('activity', []);

async function getSettings() {
  return settingsCol.all();
}
async function setSettings(full) {
  settingsCol.set(full);
  return full;
}

async function listCategories() {
  return categories.all();
}
async function insertCategory(cat) {
  categories.set([...categories.all(), cat]);
  return cat;
}
async function updateCategoryRow(id, patch) {
  const list = categories.all();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id };
  categories.set(list);
  return list[idx];
}
async function deleteCategoryRow(id) {
  categories.set(categories.all().filter((c) => c.id !== id));
}

async function listItems({ categoryId } = {}) {
  let list = items.all();
  if (categoryId) list = list.filter((i) => i.categoryId === categoryId);
  return list;
}
async function getItemById(id) {
  return items.all().find((i) => i.id === id) || null;
}
async function insertItem(item) {
  items.set([...items.all(), item]);
  return item;
}
async function updateItemRow(id, patch) {
  const list = items.all();
  const idx = list.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id };
  items.set(list);
  return list[idx];
}
async function deleteItemRow(id) {
  items.set(items.all().filter((i) => i.id !== id));
}

async function listActivity(limit = 100) {
  return activity.all().slice(0, limit);
}
async function insertActivity(entry) {
  const list = activity.all();
  list.unshift(entry);
  activity.set(list.slice(0, 300));
  return entry;
}

module.exports = {
  getSettings, setSettings,
  listCategories, insertCategory, updateCategoryRow, deleteCategoryRow,
  listItems, getItemById, insertItem, updateItemRow, deleteItemRow,
  listActivity, insertActivity,
};
