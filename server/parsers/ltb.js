// Адаптер для ltb.ge — у магазина есть открытый JSON API, которым пользуется
// их собственная витрина (SPA). Он отдаёт точную цену, артикул, остаток и
// единицу измерения по slug товара — гораздо надёжнее, чем парсить HTML.
//
// Пример ссылки: https://ltb.ge/ru/shop/productview/42933-pak1344-fila-...-h1344
// slug для API: всё после числового id и дефиса, т.е. "pak1344-fila-...-h1344"
// (сам API проглатывает и полный "42933-pak1344-..." вариант тоже, поэтому
// на всякий случай пробуем оба варианта).

const { robustFetch } = require('./fetch-utils');

const API_URL = 'https://ltb.ge/api/view/smartShop/getProducts';

function extractSlugCandidates(url) {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  const candidates = [last];
  const withoutLeadingId = last.replace(/^\d+-/, '');
  if (withoutLeadingId !== last) candidates.push(withoutLeadingId);
  return candidates;
}

async function fetchBySlug(slug, signal) {
  const res = await robustFetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}

async function parse(url, { signal } = {}) {
  const candidates = extractSlugCandidates(url);
  let lastErr = null;

  for (const slug of candidates) {
    try {
      const data = await fetchBySlug(slug, signal);
      const product = data && data.list && data.list[0];
      if (!product) { lastErr = new Error('Товар не найден по slug'); continue; }

      return {
        status: 'ok',
        price: typeof product.price === 'number' ? product.price : Number(product.price),
        currency: 'GEL',
        confidence: 'high',
        message: `Артикул ${product.sku || '—'}, остаток ${product.qty ?? '—'} ${product.dimension || ''}`.trim(),
        raw: {
          sku: product.sku,
          qty: product.qty,
          dimension: product.dimension,
          title: product.title,
          slug: product.slug,
        },
      };
    } catch (err) {
      console.error('[ltb.js]', slug, err);
      lastErr = err;
    }
  }

  return {
    status: 'error',
    message: `LTB.ge: не удалось получить цену (${lastErr ? lastErr.message : 'неизвестная ошибка'})`,
  };
}

function matches(hostname) {
  return hostname === 'ltb.ge' || hostname.endsWith('.ltb.ge');
}

module.exports = { matches, parse, id: 'ltb.ge' };
