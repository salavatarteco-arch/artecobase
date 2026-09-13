// Универсальный адаптер для сайтов без выделенного модуля.
// Пробует по убыванию надёжности:
//   1. JSON-LD (schema.org Product/Offer)
//   2. meta og:price:amount / product:price:amount / itemprop=price
//   3. Регэксп по тексту страницы (символ валюты рядом с числом)
// Если цену найти не удалось (например, это просто страница-каталог декора
// без цены, как у kronospan.com) — возвращаем status: 'no_price', это не
// ошибка сети, а нормальный результат для "референсных" ссылок.

const cheerio = require('cheerio');
const { robustFetch } = require('./fetch-utils');

// Сайты, на которых заведомо нет цены — это каталоги декоров/образцов
// производителя или дистрибьютора, а не интернет-магазин (цена там уточняется
// по звонку). Проверяем это раньше, чем тратим время на загрузку страницы —
// и показываем пользователю понятную причину, а не "ошибка"/"не найдено".
const REFERENCE_ONLY_DOMAINS = [
  'kronospan.com',
  'kasta.ge',
  'egger.com',
];

function isReferenceOnlyDomain(hostname) {
  return REFERENCE_ONLY_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

const CURRENCY_MAP = [
  { symbol: '₾', code: 'GEL' },
  { symbol: '₽', code: 'RUB' },
  { symbol: '₸', code: 'KZT' },
  { symbol: '€', code: 'EUR' },
  { symbol: '$', code: 'USD' },
];

function parseNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/\s| /g, '')
    .replace(/,(\d{1,2})$/, '.$1') // "1234,56" -> "1234.56"
    .replace(/,/g, ''); // тысячные разделители
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fromJsonLd($) {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    let json;
    try { json = JSON.parse($(s).contents().text()); } catch { continue; }
    const nodes = Array.isArray(json) ? json : [json, ...(json['@graph'] || [])];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (isProduct) {
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (offers && offers.price != null) {
          return { price: parseNumber(offers.price), currency: offers.priceCurrency || null };
        }
      }
      if (type === 'Offer' && node.price != null) {
        return { price: parseNumber(node.price), currency: node.priceCurrency || null };
      }
    }
  }
  return null;
}

function fromMeta($) {
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    'meta[name="twitter:data1"]',
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const val = el.attr('content') || el.attr('value');
      const price = parseNumber(val);
      if (price != null) {
        const currencyEl = $('meta[property="product:price:currency"], meta[property="og:price:currency"]').first();
        return { price, currency: currencyEl.attr('content') || null };
      }
    }
  }
  const itemprop = $('[itemprop="price"]').first();
  if (itemprop.length) {
    const val = itemprop.attr('content') || itemprop.text();
    const price = parseNumber(val);
    if (price != null) return { price, currency: null };
  }
  return null;
}

function fromRegex(html) {
  // Ищем "123.45 ₾" / "₾123.45" / "123,45 GEL" и т.п. рядом друг с другом.
  for (const { symbol, code } of CURRENCY_MAP) {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`${escaped}\\s?([0-9][0-9\\s.,]{1,10}[0-9])`),
      new RegExp(`([0-9][0-9\\s.,]{1,10}[0-9])\\s?${escaped}`),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) {
        const price = parseNumber(m[1]);
        if (price != null && price > 0) return { price, currency: code };
      }
    }
  }
  return null;
}

async function parse(url, { signal } = {}) {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { /* handled below by robustFetch throwing */ }

  if (isReferenceOnlyDomain(hostname)) {
    return {
      status: 'reference',
      message: 'Это каталог-справочник производителя/поставщика — цена на странице не публикуется (уточняется по звонку). Автообновление здесь недоступно, введите цену вручную.',
    };
  }

  let res;
  try {
    res = await robustFetch(url, {
      signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru,ru-RU;q=0.9,en;q=0.8,ka;q=0.7',
      },
    });
  } catch (err) {
    return { status: 'error', message: `Не удалось загрузить страницу (${err.message})` };
  }

  if (!res.ok) {
    return { status: 'error', message: `HTTP ${res.status} при загрузке страницы` };
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  let found = fromJsonLd($);
  let confidence = 'high';
  if (!found) { found = fromMeta($); confidence = 'medium'; }
  if (!found) { found = fromRegex(html); confidence = 'low'; }

  const title = $('title').first().text().trim().slice(0, 200);

  if (!found || found.price == null) {
    return {
      status: 'no_price',
      message: 'Цена на странице не найдена — возможно, это справочная страница без цены (например, каталог декоров производителя).',
      raw: { title },
    };
  }

  return {
    status: 'ok',
    price: found.price,
    currency: found.currency || null,
    confidence,
    message: title ? `Со страницы: «${title}»` : '',
  };
}

function matches() {
  return true; // fallback — подходит для любого хоста
}

module.exports = { matches, parse, id: 'generic' };
