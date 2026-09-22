// Драйвер хранения на локальных JSON-файлах — используется, когда не задан
// DATABASE_URL (обычный локальный запуск через .bat, без интернета/базы).
// Реализует тот же асинхронный интерфейс, что и driver-postgres.js, чтобы
// repo.js мог работать одинаково с обоими.

const { Collection } = require('./store-file');

const categories = new Collection('categories', []);
const items = new Collection('items', []);
const settingsCol = new Collection('settings', null);
const activity = new Collection('activity', []);

// Прайс услуг для монтажников + генератор ТЗ по монтажу.
const serviceCategories = new Collection('serviceCategories', []);
const services = new Collection('services', []);
const proposals = new Collection('proposals', []);
const proposalFiles = new Collection('proposalFiles', []);

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

// ---------- Service categories ----------
async function listServiceCategories() {
  return serviceCategories.all();
}
async function insertServiceCategory(cat) {
  serviceCategories.set([...serviceCategories.all(), cat]);
  return cat;
}
async function updateServiceCategoryRow(id, patch) {
  const list = serviceCategories.all();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id };
  serviceCategories.set(list);
  return list[idx];
}
async function deleteServiceCategoryRow(id) {
  serviceCategories.set(serviceCategories.all().filter((c) => c.id !== id));
}

// ---------- Services ----------
async function listServices({ categoryId } = {}) {
  let list = services.all();
  if (categoryId) list = list.filter((s) => s.categoryId === categoryId);
  return list;
}
async function getServiceById(id) {
  return services.all().find((s) => s.id === id) || null;
}
async function insertService(svc) {
  services.set([...services.all(), svc]);
  return svc;
}
async function updateServiceRow(id, patch) {
  const list = services.all();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id };
  services.set(list);
  return list[idx];
}
async function deleteServiceRow(id) {
  services.set(services.all().filter((s) => s.id !== id));
}

// ---------- Proposals (ТЗ) ----------
async function listProposals() {
  return proposals.all();
}
async function getProposalById(id) {
  return proposals.all().find((p) => p.id === id) || null;
}
async function getProposalByShareToken(token) {
  return proposals.all().find((p) => p.shareToken === token) || null;
}
async function insertProposal(p) {
  proposals.set([...proposals.all(), p]);
  return p;
}
async function updateProposalRow(id, patch) {
  const list = proposals.all();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id };
  proposals.set(list);
  return list[idx];
}
async function deleteProposalRow(id) {
  proposals.set(proposals.all().filter((p) => p.id !== id));
  proposalFiles.set(proposalFiles.all().filter((f) => f.proposalId !== id));
}

// ---------- Proposal files ----------
async function listProposalFiles(proposalId) {
  return proposalFiles.all()
    .filter((f) => f.proposalId === proposalId)
    .map(({ dataBase64, ...meta }) => meta); // список — без содержимого
}
async function getProposalFileById(id) {
  return proposalFiles.all().find((f) => f.id === id) || null;
}
async function insertProposalFile(file) {
  proposalFiles.set([...proposalFiles.all(), file]);
  return file;
}
async function deleteProposalFileRow(id) {
  proposalFiles.set(proposalFiles.all().filter((f) => f.id !== id));
}

module.exports = {
  getSettings, setSettings,
  listCategories, insertCategory, updateCategoryRow, deleteCategoryRow,
  listItems, getItemById, insertItem, updateItemRow, deleteItemRow,
  listActivity, insertActivity,
  listServiceCategories, insertServiceCategory, updateServiceCategoryRow, deleteServiceCategoryRow,
  listServices, getServiceById, insertService, updateServiceRow, deleteServiceRow,
  listProposals, getProposalById, getProposalByShareToken, insertProposal, updateProposalRow, deleteProposalRow,
  listProposalFiles, getProposalFileById, insertProposalFile, deleteProposalFileRow,
};
