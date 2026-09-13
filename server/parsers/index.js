const ltb = require('./ltb');
const generic = require('./generic');

// Порядок важен: специфичные адаптеры проверяются раньше общего fallback.
const ADAPTERS = [ltb, generic];

function pickAdapter(url) {
  let hostname;
  try { hostname = new URL(url).hostname; } catch { return generic; }
  return ADAPTERS.find((a) => a.matches(hostname)) || generic;
}

async function parseLink(url, opts = {}) {
  const adapter = pickAdapter(url);
  const timeoutMs = opts.timeoutMs || 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await adapter.parse(url, { signal: controller.signal });
    return { ...result, adapter: adapter.id };
  } catch (err) {
    console.error('[parser]', adapter.id, url, err);
    if (err.name === 'AbortError') {
      return { status: 'error', message: 'Превышено время ожидания ответа сайта', adapter: adapter.id };
    }
    return { status: 'error', message: err.message, adapter: adapter.id };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { parseLink, pickAdapter };
