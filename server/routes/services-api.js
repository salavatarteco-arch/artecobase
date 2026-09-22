// API прайса услуг для монтажников + генератора ТЗ по монтажу.
// Смонтирован в server/app.js рядом с основным /api (материалы/фурнитура) —
// домен другой, но то же приложение, то же хранилище (server/data/repo.js
// содержит общие settings; server/data/services-repo.js — свою логику).

const express = require('express');
const services = require('../data/services-repo');
const repo = require('../data/repo');

const router = express.Router();

function h(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------- Service categories ----------
router.get('/service-categories', h(async (req, res) => res.json(await services.listServiceCategories())));
router.post('/service-categories', h(async (req, res) => {
  if (!req.body || !req.body.name) return res.status(400).json({ error: 'Укажите название категории' });
  res.status(201).json(await services.createServiceCategory(req.body));
}));
router.put('/service-categories/:id', h(async (req, res) => {
  const updated = await services.updateServiceCategory(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Категория не найдена' });
  res.json(updated);
}));
router.delete('/service-categories/:id', h(async (req, res) => {
  await services.deleteServiceCategory(req.params.id);
  res.status(204).end();
}));

// ---------- Services ----------
router.get('/services', h(async (req, res) => {
  res.json(await services.listServices({ categoryId: req.query.categoryId || undefined }));
}));
router.post('/services', h(async (req, res) => {
  if (!req.body || !req.body.name) return res.status(400).json({ error: 'Укажите название услуги' });
  res.status(201).json(await services.createService(req.body));
}));
router.put('/services/:id', h(async (req, res) => {
  const updated = await services.updateService(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Услуга не найдена' });
  res.json(updated);
}));
router.delete('/services/:id', h(async (req, res) => {
  await services.deleteService(req.params.id);
  res.status(204).end();
}));

// ---------- Proposals (ТЗ) ----------
router.get('/proposals', h(async (req, res) => res.json(await services.listProposals())));
router.get('/proposals/:id', h(async (req, res) => {
  const p = await services.getProposal(req.params.id);
  if (!p) return res.status(404).json({ error: 'ТЗ не найдено' });
  const files = await services.listProposalFiles(p.id);
  res.json({ ...p, files });
}));
router.post('/proposals', h(async (req, res) => {
  res.status(201).json(await services.createProposal(req.body || {}));
}));
router.put('/proposals/:id', h(async (req, res) => {
  const updated = await services.updateProposal(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'ТЗ не найдено' });
  res.json(updated);
}));
router.delete('/proposals/:id', h(async (req, res) => {
  await services.deleteProposal(req.params.id);
  res.status(204).end();
}));
router.post('/proposals/:id/duplicate', h(async (req, res) => {
  const copy = await services.duplicateProposal(req.params.id);
  if (!copy) return res.status(404).json({ error: 'ТЗ не найдено' });
  res.status(201).json(copy);
}));

// ---------- Файлы ТЗ (чертежи, эскизы) ----------
// Тело запроса — сырые байты файла (без multipart, без доп. зависимостей).
// Имя файла передаётся в заголовке X-Filename в encodeURIComponent.
router.post('/proposals/:id/files', express.raw({ type: '*/*', limit: '16mb' }), h(async (req, res) => {
  const p = await services.getProposal(req.params.id);
  if (!p) return res.status(404).json({ error: 'ТЗ не найдено' });
  if (!req.body || !req.body.length) return res.status(400).json({ error: 'Файл пуст' });
  let filename = 'файл';
  try { filename = decodeURIComponent(req.get('X-Filename') || 'файл'); } catch { filename = req.get('X-Filename') || 'файл'; }
  try {
    const meta = await services.addProposalFile(p.id, {
      filename,
      mimeType: req.get('Content-Type') || 'application/octet-stream',
      buffer: req.body,
    });
    res.status(201).json(meta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));
router.get('/proposals/:id/files', h(async (req, res) => {
  res.json(await services.listProposalFiles(req.params.id));
}));
router.get('/proposal-files/:fileId', h(async (req, res) => {
  const file = await services.getProposalFile(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  const buf = Buffer.from(file.dataBase64, 'base64');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
  res.send(buf);
}));
router.delete('/proposal-files/:fileId', h(async (req, res) => {
  await services.deleteProposalFile(req.params.fileId);
  res.status(204).end();
}));

// ---------- Публичный доступ по ссылке (для монтажника, без пароля) ----------
// Открывается по нечитаемому shareToken — см. исключение из auth.js.
router.get('/public/proposals/:token', h(async (req, res) => {
  const p = await services.getProposalByShareToken(req.params.token);
  if (!p) return res.status(404).json({ error: 'ТЗ не найдено или ссылка недействительна' });
  const [files, settings] = await Promise.all([services.listProposalFiles(p.id), repo.getSettings()]);
  res.json({ ...p, files, servicesNotice: settings.servicesNotice, servicesCurrencySymbol: settings.servicesCurrencySymbol });
}));
router.get('/public/proposals/:token/files/:fileId', h(async (req, res) => {
  const p = await services.getProposalByShareToken(req.params.token);
  if (!p) return res.status(404).json({ error: 'Ссылка недействительна' });
  const files = await services.listProposalFiles(p.id);
  if (!files.some((f) => f.id === req.params.fileId)) return res.status(404).json({ error: 'Файл не найден' });
  const file = await services.getProposalFile(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  const buf = Buffer.from(file.dataBase64, 'base64');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
  res.send(buf);
}));

module.exports = router;
