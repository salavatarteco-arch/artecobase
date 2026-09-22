const express = require('express');
const { nanoid } = require('nanoid');
const repo = require('../data/repo');
const { parseLink } = require('../parsers');
const { buildWorkbook } = require('../export/xlsx-export');
const { importWorkbook } = require('../export/xlsx-import');

const router = express.Router();

// Оборачивает async-хендлер так, чтобы отклонённый промис (ошибка сети к базе,
// таймаут и т.п.) не "тихо" крашил процесс, а превращался в понятный ответ 500 —
// без этого при DATABASE_URL (Postgres) любая сетевая ошибка роняла бы сервер.
function h(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---------- Settings ----------
router.get('/settings', h(async (req, res) => res.json(await repo.getSettings())));
router.put('/settings', h(async (req, res) => res.json(await repo.updateSettings(req.body || {}))));

// ---------- Categories ----------
router.get('/categories', h(async (req, res) => res.json(await repo.listCategories())));
router.post('/categories', h(async (req, res) => {
  if (!req.body || !req.body.name) return res.status(400).json({ error: 'Укажите название категории' });
  res.status(201).json(await repo.createCategory(req.body));
}));
router.put('/categories/:id', h(async (req, res) => {
  const updated = await repo.updateCategory(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Категория не найдена' });
  res.json(updated);
}));
router.delete('/categories/:id', h(async (req, res) => {
  await repo.deleteCategory(req.params.id);
  res.status(204).end();
}));

// ---------- Items ----------
router.get('/items', h(async (req, res) => {
  res.json(await repo.listItems({ categoryId: req.query.categoryId || undefined }));
}));
router.get('/items/:id', h(async (req, res) => {
  const item = await repo.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });
  res.json(item);
}));
router.post('/items', h(async (req, res) => {
  res.status(201).json(await repo.createItem(req.body || {}));
}));
router.put('/items/:id', h(async (req, res) => {
  const updated = await repo.updateItem(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Позиция не найдена' });
  res.json(updated);
}));
router.delete('/items/:id', h(async (req, res) => {
  await repo.deleteItem(req.params.id);
  res.status(204).end();
}));
router.post('/items/:id/duplicate', h(async (req, res) => {
  const copy = await repo.duplicateItem(req.params.id);
  if (!copy) return res.status(404).json({ error: 'Позиция не найдена' });
  res.status(201).json(copy);
}));

// ---------- Файлы документации у позиции (спецификации, сертификаты и т.п.) ----------
// Тело запроса — сырые байты файла (без multipart, без доп. зависимостей).
// Имя файла передаётся в заголовке X-Filename в encodeURIComponent.
router.post('/items/:id/files', express.raw({ type: '*/*', limit: '16mb' }), h(async (req, res) => {
  const item = await repo.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });
  if (!req.body || !req.body.length) return res.status(400).json({ error: 'Файл пуст' });
  let filename = 'файл';
  try { filename = decodeURIComponent(req.get('X-Filename') || 'файл'); } catch { filename = req.get('X-Filename') || 'файл'; }
  try {
    const meta = await repo.addItemFile(item.id, {
      filename,
      mimeType: req.get('Content-Type') || 'application/octet-stream',
      buffer: req.body,
    });
    res.status(201).json(meta);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));
router.get('/items/:id/files', h(async (req, res) => {
  res.json(await repo.listItemFiles(req.params.id));
}));
router.get('/item-files/:fileId', h(async (req, res) => {
  const file = await repo.getItemFile(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  const buf = Buffer.from(file.dataBase64, 'base64');
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
  res.send(buf);
}));
router.delete('/item-files/:fileId', h(async (req, res) => {
  await repo.deleteItemFile(req.params.fileId);
  res.status(204).end();
}));

// ---------- Links ----------
router.post('/items/:id/links', h(async (req, res) => {
  const item = await repo.getItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });
  const link = {
    id: nanoid(8),
    url: req.body.url,
    label: req.body.label || '',
    autoParse: req.body.autoParse !== false,
    lastPrice: null,
    lastCurrency: null,
    lastParsedAt: null,
    status: 'pending',
    statusMessage: '',
  };
  const links = [...(item.links || []), link];
  const updated = await repo.updateItem(item.id, { links });
  res.status(201).json(updated);
}));
router.delete('/items/:itemId/links/:linkId', h(async (req, res) => {
  const item = await repo.getItem(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });
  const links = (item.links || []).filter((l) => l.id !== req.params.linkId);
  const updated = await repo.updateItem(item.id, { links });
  res.json(updated);
}));

// Спарсить одну ссылку и применить цену к позиции
router.post('/items/:itemId/links/:linkId/parse', h(async (req, res) => {
  const item = await repo.getItem(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Позиция не найдена' });
  const link = (item.links || []).find((l) => l.id === req.params.linkId);
  if (!link) return res.status(404).json({ error: 'Ссылка не найдена' });

  const result = await parseLink(link.url);
  const updated = await repo.applyParsedPrice(item.id, link.id, result);
  res.json({ result, item: updated });
}));

// Массовое обновление: все ссылки во всех позициях (или в одной категории)
router.post('/parse/bulk', h(async (req, res) => {
  const { categoryId } = req.body || {};
  const items = await repo.listItems({ categoryId });
  const jobs = [];
  for (const item of items) {
    for (const link of item.links || []) {
      if (link.autoParse === false) continue;
      jobs.push({ itemId: item.id, linkId: link.id, url: link.url });
    }
  }

  const results = [];
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const result = await parseLink(job.url);
      await repo.applyParsedPrice(job.itemId, job.linkId, result);
      results.push({ ...job, status: result.status, price: result.price ?? null, message: result.message });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  res.json({ total: jobs.length, summary, results });
}));

// ---------- Activity log ----------
router.get('/activity', h(async (req, res) => res.json(await repo.listActivity(Number(req.query.limit) || 100))));

// ---------- Export / Import ----------
router.get('/export/xlsx', h(async (req, res) => {
  const buffer = await buildWorkbook();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ARTEKO-price-list.xlsx"');
  res.send(buffer);
}));

router.post('/import/xlsx', express.raw({ type: '*/*', limit: '25mb' }), h(async (req, res) => {
  try {
    const summary = await importWorkbook(req.body);
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

module.exports = router;
