// Точка входа для локального запуска (.bat / npm start).
// Для деплоя на Vercel используется api/index.js, который переиспользует
// тот же createApp() без app.listen (там сервером управляет платформа).
const { createApp } = require('./app');

const PORT = process.env.PORT || 4173;
const app = createApp();

app.listen(PORT, () => {
  console.log(`\n  АРТЕКО — прайс-лист запущен: http://localhost:${PORT}\n`);
});
