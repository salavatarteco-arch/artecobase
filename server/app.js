const path = require('path');
const express = require('express');
const apiRouter = require('./routes/api');
const servicesApiRouter = require('./routes/services-api');
const kHandler = require('../api/k'); // тот же обработчик, что и в Vercel (api/k.js) — см. vercel.json
const auth = require('./auth');

function createApp() {
  const app = express();

  auth.mount(app); // не-операция, если APP_PASSWORD не задан (локальный режим)

  app.use(express.json({ limit: '10mb' }));
  app.use('/api', apiRouter);
  app.use('/api', servicesApiRouter);

  // Локальный эквивалент rewrite "/k/:id -> /api/k?id=:id" из vercel.json —
  // на Vercel этим занимается платформа, здесь при обычном запуске (.bat)
  // роут нужен явно, иначе ссылка КП открыла бы прайс материалов.
  app.get('/k/:id', (req, res, next) => {
    req.query = { ...req.query, id: req.params.id };
    Promise.resolve(kHandler(req, res)).catch(next);
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // Единая обработка ошибок — асинхронные ошибки из роутов (сеть до базы,
  // таймауты и т.п.) попадают сюда через next(err) и превращаются в понятный
  // JSON-ответ, а не роняют процесс и не отдают голый HTML со стектрейсом.
  app.use((err, req, res, next) => {
    console.error('[error]', req.method, req.path, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера. Попробуйте ещё раз.' });
  });

  return app;
}

module.exports = { createApp };
