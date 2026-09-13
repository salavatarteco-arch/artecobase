// Точка входа для Vercel (Node.js Serverless Function).
// Vercel сам оборачивает экспортированное Express-приложение в обработчик
// запроса — отдельный http-сервер поднимать не нужно (и нельзя).
const { createApp } = require('../server/app');

module.exports = createApp();
