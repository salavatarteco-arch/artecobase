// Отдаёт ссылку на КП (/k/<id>, см. rewrite в vercel.json) с настоящими
// og:title / og:description / og:image — мессенджеры и соцсети читают эту
// HTML-версию напрямую (не выполняют наш клиентский JS), поэтому превью
// ссылки в WhatsApp/Telegram выглядит нормально, а не голым URL.
//
// Дальше страница работает как обычно — сам генератор (public/kp.html)
// подхватывает КП на клиенте через #k=<id> (см. его init()); эта функция
// только подставляет мета-теги и, если получилось, сразу вшивает JSON КП
// в страницу (чтобы не делать второй запрос к Cloudinary).
//
// Если что-то не так (нет id, Cloudinary недоступен и т.п.) — просто
// отдаём обычный public/kp.html, как если бы зашли на "/" — тупика нет.

const fs = require('fs');
const path = require('path');

const CLOUD_NAME = 'dn2f28hxv';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtPrice(n) {
  n = Number(n) || 0;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}
function totalFromCompact(compact) {
  const groups = Array.isArray(compact.gr) ? compact.gr : [];
  let total = 0;
  let image = '';
  groups.forEach((g) => {
    const items = (g && g[1]) || [];
    items.forEach((it) => { total += Number(it && it[2]) || 0; });
    if (!image && g && g[2]) image = g[2];
  });
  return { total, image };
}

module.exports = async function handler(req, res) {
  const rawId = (req.query && req.query.id) || '';
  const id = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '');

  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'public', 'kp.html'), 'utf8');
  } catch (e) {
    res.status(500).send('kp.html not found');
    return;
  }

  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html.replace('<!--OG_TAGS-->', '').replace('<!--PRELOAD_KP-->', ''));
    return;
  }

  try {
    const jsonUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${id}.json`;
    const r = await fetch(jsonUrl);
    if (!r.ok) throw new Error('not_found');
    const compact = await r.json();

    const title = compact.t || 'Коммерческое предложение АРТЕКО';
    const client = compact.c || '';
    const { total, image } = totalFromCompact(compact);
    const description = (client ? `Клиент: ${client} · ` : '') + `Итого: ${fmtPrice(total)} ₾`;
    const host = req.headers.host || 'arteko-price-list.vercel.app';
    const pageUrl = `https://${host}/k/${id}`;

    const ogTags = `<meta property="og:title" content="${esc(title)}">\n`
      + `<meta property="og:description" content="${esc(description)}">\n`
      + `<meta property="og:url" content="${esc(pageUrl)}">\n`
      + `<meta property="og:type" content="website">\n`
      + (image
        ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n`
        : `<meta name="twitter:card" content="summary">\n`)
      + `<meta name="twitter:title" content="${esc(title)}">\n`
      + `<meta name="twitter:description" content="${esc(description)}">\n`;

    const preloadJson = JSON.stringify(compact).replace(/</g, '\\u003c');
    const preloadScript = `<script>window.__PRELOADED_KP__=${preloadJson};</script>`;

    html = html.replace('<!--OG_TAGS-->', ogTags).replace('<!--PRELOAD_KP-->', preloadScript);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html.replace('<!--OG_TAGS-->', '').replace('<!--PRELOAD_KP-->', ''));
  }
};
