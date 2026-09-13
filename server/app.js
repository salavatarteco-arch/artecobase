const path = require('path');
const express = require('express');
const apiRouter = require('./routes/api');
const auth = require('./auth');

function createApp() {
  const app = express();

  auth.mount(app); // не-операция, если APP_PASSWORD не задан (локальный режим)

  app.use(express.json({ limit: '10mb' }));
  app.use('/api', apiRouter);
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
