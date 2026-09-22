// АРТЕКО — прайс-лист. Vanilla JS SPA, без сборки.

// ----------------------------------------------------------------- icons ---
// Единый набор line-иконок (24×24, stroke=currentColor) — используются везде
// вместо эмодзи: и в навигации, и в кнопках, и в статусах.
const ICONS = {
  box: '<path d="M3 8 12 3 21 8 21 17 12 22 3 17Z"/><path d="M3 8 12 13 21 8"/><path d="M12 13V22"/>',
  layers: '<path d="M12 3 21 8 12 13 3 8Z"/><path d="M3 13 12 18 21 13"/><path d="M3 17.5 12 22 21 17.5"/>',
  countertop: '<rect x="3" y="10" width="18" height="5" rx="1.5"/><circle cx="16" cy="12.5" r="1.3"/>',
  hinge: '<rect x="7" y="3" width="10" height="18" rx="1.5"/><circle cx="7" cy="8" r="1.3"/><circle cx="7" cy="16" r="1.3"/>',
  slide: '<path d="M4 8H16"/><path d="M4 16H20"/><path d="M17 5 20 8 17 11"/>',
  hook: '<path d="M8 3V10A4 4 0 1 0 15 12"/><path d="M6 3H10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20 15.5 15.5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  download: '<path d="M12 3V15"/><path d="M7 10 12 15 17 10"/><path d="M4 19H20"/>',
  upload: '<path d="M12 15V3"/><path d="M7 8 12 3 17 8"/><path d="M4 19H20"/>',
  plus: '<path d="M12 4V20"/><path d="M4 12H20"/>',
  sliders: '<path d="M4 7H20"/><circle cx="9" cy="7" r="2"/><path d="M4 17H20"/><circle cx="15" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7V12L15.5 14"/>',
  edit: '<path d="M4 20 4.8 16.6 15.5 5.9A2 2 0 0 1 18.3 5.9L18.5 6.1A2 2 0 0 1 18.5 8.9L7.8 19.6Z"/><path d="M13.8 7.6 16.4 10.2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15H4A1 1 0 0 1 3 14V4A1 1 0 0 1 4 3H14A1 1 0 0 1 15 4V5"/>',
  trash: '<path d="M4 7H20"/><path d="M9 7V4.5A1 1 0 0 1 10 3.5H14A1 1 0 0 1 15 4.5V7"/><path d="M6 7 7 20A1.2 1.2 0 0 0 8.2 21H15.8A1.2 1.2 0 0 0 17 20L18 7"/>',
  link: '<path d="M14 4H20V10"/><path d="M20 4 11 13"/><path d="M18 14V19A1 1 0 0 1 17 20H5A1 1 0 0 1 4 19V7A1 1 0 0 1 5 6H10"/>',
  close: '<path d="M5 5 19 19"/><path d="M19 5 5 19"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V13"/><circle cx="12" cy="16.2" r=".6" fill="currentColor" stroke="none"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3 11 15.3 16.3 9"/>',
  trend: '<path d="M4 16 10 10 14 13 20 6"/><path d="M20 6H15"/><path d="M20 6V11"/>',
  tag: '<path d="M3 11 11 3H15L21 9V13L13 21 3 11Z"/><circle cx="9.5" cy="8.5" r="1.3"/>',
  stack: '<path d="M12 3 21 8 12 13 3 8Z"/><path d="M3 13 12 18 21 13"/>',
};
function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.box}</svg>`;
}
// Иконка категории подбирается по названию — так все плитные материалы
// выглядят согласованно, без ручной привязки эмодзи к каждой записи.
function guessCategoryIcon(name) {
  const n = (name || '').toLowerCase();
  if (/столешниц/.test(n)) return 'countertop';
  if (/петл/.test(n)) return 'hinge';
  if (/направляющ/.test(n)) return 'slide';
  if (/навес/.test(n)) return 'hook';
  if (/лдсп|мдф|хдф|плит/.test(n)) return 'layers';
  return 'box';
}

// ---------------------------------------------------------------- state ---
const state = {
  categories: [],
  items: [],
  settings: null,
  currentCategoryId: null,
  search: '',
  editingItemId: null, // null = создание новой позиции
};

// ------------------------------------------------------------------- api ---
const api = {
  async get(url) { return req('GET', url); },
  async post(url, body) { return req('POST', url, body); },
  async put(url, body) { return req('PUT', url, body); },
  async del(url) { return req('DELETE', url); },
};

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ----------------------------------------------------------------- toast ---
function toast(message, type = '') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type ? `toast-${type}` : ''}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// --------------------------------------------------------------- helpers ---
function fmtMoney(n, symbol) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${symbol || ''}`.trim();
}
function fmtNum(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: digits });
}
function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}
function timeAgo(iso) {
  if (!iso) return 'никогда';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU');
}
function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function linkFreshness(link) {
  if (!link.lastParsedAt) return { cls: 'gray', label: 'не проверено' };
  if (link.status === 'error') return { cls: 'red', label: 'ошибка' };
  if (link.status === 'reference') return { cls: 'blue', label: 'справочная, без автоцены' };
  if (link.status === 'no_price') return { cls: 'gray', label: 'цена не найдена' };
  const days = (Date.now() - new Date(link.lastParsedAt).getTime()) / 86400000;
  if (days > 14) return { cls: 'amber', label: 'устарело' };
  return { cls: 'green', label: 'актуально' };
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ------------------------------------------------------------------ load ---
async function loadAll() {
  const [settings, categories] = await Promise.all([api.get('/api/settings'), api.get('/api/categories')]);
  state.settings = settings;
  state.categories = categories.sort((a, b) => a.sortOrder - b.sortOrder);
  if (!state.currentCategoryId && categories.length) state.currentCategoryId = categories[0].id;
  await loadItems();
  renderSidebar();
  renderTopbar();
  renderTable();
}

async function loadItems() {
  if (!state.currentCategoryId) { state.items = []; return; }
  state.items = await api.get(`/api/items?categoryId=${state.currentCategoryId}`);
}

// --------------------------------------------------------------- sidebar ---
function renderSidebar() {
  const list = document.getElementById('category-list');
  list.innerHTML = '';
  for (const cat of state.categories) {
    const el = document.createElement('div');
    el.className = 'category-item' + (cat.id === state.currentCategoryId ? ' active' : '');
    el.innerHTML = `
      <span class="cat-icon">${icon(guessCategoryIcon(cat.name))}</span>
      <span class="cat-name">${escapeHtml(cat.name)}</span>
      <span class="cat-edit" data-edit-cat="${cat.id}" title="Настройки категории">${icon('edit')}</span>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-cat]')) return;
      state.currentCategoryId = cat.id;
      state.search = '';
      document.getElementById('search-input').value = '';
      loadItems().then(() => { renderSidebar(); renderTopbar(); renderTable(); });
    });
    list.appendChild(el);
  }
  list.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    btn.addEventListener('click', () => openCategoryEdit(btn.dataset.editCat));
  });
  // счётчики позиций проставим асинхронно, не блокируя рендер
  countItemsPerCategory();
}

async function countItemsPerCategory() {
  const all = await api.get('/api/items');
  const counts = {};
  for (const it of all) counts[it.categoryId] = (counts[it.categoryId] || 0) + 1;
  document.querySelectorAll('.category-item').forEach((el, idx) => {
    const cat = state.categories[idx];
    if (!cat) return;
    let badge = el.querySelector('.cat-count');
    const n = counts[cat.id] || 0;
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cat-count';
      el.insertBefore(badge, el.querySelector('.cat-edit'));
    }
    badge.textContent = n;
  });
}

// ---------------------------------------------------------------- topbar ---
function renderTopbar() {
  const cat = currentCategory();
  document.getElementById('category-title').textContent = cat ? cat.name : 'Нет категорий';
  document.getElementById('category-meta').textContent = cat
    ? `${cat.pricingMode === 'sheet' ? 'Плитный материал · цена за м²' : 'Штучная позиция'} · ед. изм. ${cat.unit}`
    : 'Создайте первую категорию слева';
  document.getElementById('btn-add-item').disabled = !cat;
  document.getElementById('btn-bulk-parse').disabled = !cat;
}

function currentCategory() {
  return state.categories.find((c) => c.id === state.currentCategoryId) || null;
}

// ----------------------------------------------------------------- table ---
function filteredItems() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.items;
  return state.items.filter((it) => [it.name, it.sku, it.manufacturer, it.subcategory]
    .filter(Boolean).some((v) => v.toLowerCase().includes(q)));
}

function renderTable() {
  const cat = currentCategory();
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  const emptyState = document.getElementById('empty-state');

  if (!cat) {
    thead.innerHTML = ''; tbody.innerHTML = '';
    emptyState.hidden = false;
    emptyState.querySelector('p').textContent = 'Сначала создайте категорию слева.';
    document.getElementById('btn-add-item-empty').style.display = 'none';
    document.getElementById('stat-strip').innerHTML = '';
    return;
  }

  renderStatStrip(cat);

  const isSheet = cat.pricingMode === 'sheet';
  const symbol = state.settings.currencySymbol;

  thead.innerHTML = isSheet ? `
    <tr>
      <th>Название</th>
      <th class="num">Цена плиты</th>
      <th class="num">Высота, м</th>
      <th class="num">Ширина, м</th>
      <th class="num">Площадь, м²</th>
      <th class="num">Себест. /м²</th>
      <th class="num">Клиенту /м²</th>
      <th>Ссылки</th>
      <th>Обновлено</th>
      <th></th>
    </tr>` : `
    <tr>
      <th>Название</th>
      <th>Артикул</th>
      <th class="num">Себестоимость</th>
      <th class="num">Розничная цена</th>
      <th class="num">Остаток</th>
      <th>Ссылки</th>
      <th>Обновлено</th>
      <th></th>
    </tr>`;

  const items = filteredItems();
  emptyState.hidden = items.length > 0;
  document.getElementById('btn-add-item-empty').style.display = '';
  if (items.length === 0) {
    tbody.innerHTML = '';
    emptyState.querySelector('p').textContent = state.search
      ? 'Ничего не найдено по запросу.'
      : 'В этой категории пока нет позиций.';
    return;
  }

  // группировка по подкатегории, сохраняя исходный порядок появления
  const groups = [];
  const groupIndex = new Map();
  for (const it of items) {
    const key = it.subcategory || '';
    if (!groupIndex.has(key)) { groupIndex.set(key, groups.length); groups.push({ key, rows: [] }); }
    groups[groupIndex.get(key)].rows.push(it);
  }

  const colspan = isSheet ? 10 : 8;
  let html = '';
  for (const group of groups) {
    if (group.key) {
      html += `<tr class="subcategory-row"><td colspan="${colspan}">${escapeHtml(group.key)}</td></tr>`;
    }
    for (const it of group.rows) {
      html += isSheet ? rowSheetHtml(it, symbol) : rowDirectHtml(it, symbol);
    }
  }
  tbody.innerHTML = html;
  bindRowEvents();
}

// -------------------------------------------------------------- stat strip ---
function renderStatStrip(cat) {
  const strip = document.getElementById('stat-strip');
  const items = state.items;
  const symbol = state.settings.currencySymbol;

  const withPrice = items.filter((it) => it.retailPrice > 0);
  const avgPrice = withPrice.length ? withPrice.reduce((s, it) => s + it.retailPrice, 0) / withPrice.length : 0;

  let attention = 0;
  let lastUpdate = null;
  for (const it of items) {
    for (const l of it.links || []) {
      const fr = linkFreshness(l);
      if (fr.cls === 'red' || fr.cls === 'amber') attention += 1;
      if (l.lastParsedAt && (!lastUpdate || l.lastParsedAt > lastUpdate)) lastUpdate = l.lastParsedAt;
    }
  }
  const linkCount = items.reduce((s, it) => s + (it.links ? it.links.length : 0), 0);

  const tiles = [
    { icon: 'stack', label: 'Позиций в категории', value: fmtNum(items.length, 0) },
    { icon: 'tag', label: cat.pricingMode === 'sheet' ? 'Средняя цена, /м²' : 'Средняя цена', value: withPrice.length ? fmtMoney(avgPrice, symbol) : '—' },
    {
      icon: attention > 0 ? 'alert' : 'check', label: 'Требуют внимания', value: fmtNum(attention, 0),
      tone: attention > 0 ? 'warn' : 'ok',
      hint: linkCount ? `из ${linkCount} ссылок` : 'нет ссылок',
    },
    { icon: 'clock', label: 'Последнее обновление цены', value: lastUpdate ? timeAgo(lastUpdate) : 'ещё не было' },
  ];

  strip.innerHTML = tiles.map((t) => `
    <div class="stat-tile${t.tone ? ` stat-tile-${t.tone}` : ''}">
      <span class="stat-tile-icon">${icon(t.icon, 'icon-lg')}</span>
      <div class="stat-tile-body">
        <span class="stat-tile-label">${escapeHtml(t.label)}</span>
        <strong class="stat-tile-value">${t.value}</strong>
        ${t.hint ? `<span class="stat-tile-hint">${escapeHtml(t.hint)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function linksCellHtml(item) {
  if (!item.links || item.links.length === 0) {
    return `<div class="link-cell"><span class="muted">нет ссылок</span></div>`;
  }
  const rows = item.links.map((l) => {
    const fr = linkFreshness(l);
    return `
      <div class="link-row" data-link-id="${l.id}">
        <span class="link-status-dot badge-${fr.cls}" style="background:var(--${fr.cls}-fg)" title="${fr.label}${l.lastParsedAt ? ' · ' + timeAgo(l.lastParsedAt) : ''}"></span>
        <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" title="${escapeHtml(l.url)}">${escapeHtml(hostnameOf(l.url))}</a>
        <button class="link-parse-btn" data-parse-link="${item.id}:${l.id}" title="Обновить цену по ссылке">${icon('refresh')}</button>
      </div>`;
  }).join('');
  return `<div class="link-cell">${rows}</div>`;
}

function nameCellHtml(it) {
  const thumb = it.imageUrl ? `<img class="row-thumb" src="${it.imageUrl}" alt="" />` : '';
  return `${thumb}<div class="name-cell-text">${escapeHtml(it.name)}${it.manufacturer ? `<span class="sub">${escapeHtml(it.manufacturer)}</span>` : ''}</div>`;
}

function rowSheetHtml(it, symbol) {
  return `
    <tr data-item-id="${it.id}">
      <td class="name-cell">${nameCellHtml(it)}</td>
      <td class="num"><span class="editable" contenteditable data-field="priceSheet" data-item="${it.id}">${it.priceSheet ?? ''}</span></td>
      <td class="num"><span class="editable" contenteditable data-field="heightM" data-item="${it.id}">${it.heightM ?? ''}</span></td>
      <td class="num"><span class="editable" contenteditable data-field="widthM" data-item="${it.id}">${it.widthM ?? ''}</span></td>
      <td class="num muted-cell">${fmtNum(it.area, 3)}</td>
      <td class="num muted-cell">${fmtNum(it.costPerUnit)}</td>
      <td class="num"><strong>${fmtMoney(it.retailPrice, symbol)}</strong></td>
      <td>${linksCellHtml(it)}</td>
      <td class="muted-cell">${timeAgo(it.updatedAt)}</td>
      <td>${rowActionsHtml(it.id)}</td>
    </tr>`;
}

function articlesText(it) {
  if (it.sku) return it.sku;
  if (it.articles && it.articles.length) {
    return it.articles.map((a) => a.label ? `${a.label}: ${a.value}` : a.value).join(' · ');
  }
  return '—';
}

function rowDirectHtml(it, symbol) {
  return `
    <tr data-item-id="${it.id}">
      <td class="name-cell">${nameCellHtml(it)}</td>
      <td class="muted-cell">${escapeHtml(articlesText(it))}</td>
      <td class="num"><span class="editable" contenteditable data-field="cost" data-item="${it.id}">${it.cost ?? 0}</span></td>
      <td class="num"><strong>${fmtMoney(it.retailPrice, symbol)}</strong></td>
      <td class="num"><span class="editable" contenteditable data-field="stockQty" data-item="${it.id}">${it.stockQty ?? ''}</span></td>
      <td>${linksCellHtml(it)}</td>
      <td class="muted-cell">${timeAgo(it.updatedAt)}</td>
      <td>${rowActionsHtml(it.id)}</td>
    </tr>`;
}

function rowActionsHtml(id) {
  return `
    <div class="row-actions">
      <button class="btn btn-icon btn-ghost" data-edit-item="${id}" title="Открыть карточку">${icon('edit')}</button>
      <button class="btn btn-icon btn-ghost" data-dup-item="${id}" title="Дублировать">${icon('copy')}</button>
      <button class="btn btn-icon btn-ghost" data-del-item="${id}" title="Удалить">${icon('trash')}</button>
    </div>`;
}

function selectAllText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function bindRowEvents() {
  document.querySelectorAll('.editable').forEach((el) => {
    el.addEventListener('focus', () => selectAllText(el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); el.textContent = el.dataset.original ?? el.textContent; el.blur(); }
    });
    el.dataset.original = el.textContent;
    el.addEventListener('blur', onEditableBlur);
  });
  document.querySelectorAll('[data-edit-item]').forEach((b) => b.addEventListener('click', () => openItemModal(b.dataset.editItem)));
  document.querySelectorAll('[data-dup-item]').forEach((b) => b.addEventListener('click', () => duplicateItem(b.dataset.dupItem)));
  document.querySelectorAll('[data-del-item]').forEach((b) => b.addEventListener('click', () => deleteItem(b.dataset.delItem)));
  document.querySelectorAll('[data-parse-link]').forEach((b) => b.addEventListener('click', () => {
    const [itemId, linkId] = b.dataset.parseLink.split(':');
    parseOneLink(itemId, linkId, b);
  }));
}

async function onEditableBlur(e) {
  const el = e.target;
  const field = el.dataset.field;
  const itemId = el.dataset.item;
  const raw = el.textContent.trim().replace(',', '.');
  const value = raw === '' ? null : Number(raw);
  if (raw !== '' && Number.isNaN(value)) { toast('Введите число', 'error'); renderTable(); return; }
  try {
    await api.put(`/api/items/${itemId}`, { [field]: value });
    await loadItems();
    renderTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function duplicateItem(id) {
  await api.post(`/api/items/${id}/duplicate`);
  await loadItems();
  renderTable();
  toast('Позиция продублирована');
}

async function deleteItem(id) {
  if (!confirm('Удалить эту позицию из прайс-листа?')) return;
  await api.del(`/api/items/${id}`);
  await loadItems();
  renderTable();
  toast('Позиция удалена');
}

async function parseOneLink(itemId, linkId, btnEl) {
  btnEl?.classList.add('spinning');
  try {
    const { result } = await api.post(`/api/items/${itemId}/links/${linkId}/parse`);
    await loadItems();
    renderTable();
    if (result.status === 'ok') toast(`Цена обновлена: ${fmtMoney(result.price, result.currency === 'GEL' ? '₾' : (result.currency || ''))}`, 'success');
    else if (result.status === 'reference') toast('Это справочная ссылка каталога поставщика — цены на странице нет, введите вручную', '');
    else if (result.status === 'no_price') toast('На странице не нашлась цена — возможно, структура сайта нестандартная', '');
    else toast(result.message || 'Не удалось обновить цену', 'error');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ------------------------------------------------------------ bulk parse ---
async function bulkParseCurrentCategory() {
  const cat = currentCategory();
  if (!cat) return;
  const btn = document.getElementById('btn-bulk-parse');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon('refresh', 'spinning')} Обновление…`;
  try {
    const res = await api.post('/api/parse/bulk', { categoryId: cat.id });
    await loadItems();
    renderTable();
    const s = res.summary;
    const parts = [];
    if (s.ok) parts.push(`обновлено: ${s.ok}`);
    if (s.reference) parts.push(`справочных (без цены на сайте): ${s.reference}`);
    if (s.no_price) parts.push(`не нашли цену: ${s.no_price}`);
    if (s.error) parts.push(`ошибок: ${s.error}`);
    toast(res.total === 0 ? 'В этой категории нет ссылок для обновления' : `Готово (${res.total} ссылок) — ${parts.join(', ') || 'нет изменений'}`, s.ok ? 'success' : '');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// -------------------------------------------------------------- modals ----
function openModal(id) { document.getElementById(`${id}-backdrop`).hidden = false; }
function closeModal(id) { document.getElementById(`${id}-backdrop`).hidden = true; }

document.querySelectorAll('[data-close-modal]').forEach((el) => {
  el.addEventListener('click', () => closeModal(el.dataset.closeModal));
});
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.hidden = true; });
});

// ---- category modal ----
function openCategoryCreate() {
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-pricing-mode').value = 'sheet';
  document.getElementById('cat-unit').value = 'м²';
  document.querySelector('#category-modal .modal-header h2').textContent = 'Новая категория';
  document.getElementById('btn-save-category').textContent = 'Создать';
  document.getElementById('btn-save-category').onclick = saveNewCategory;
  document.getElementById('btn-delete-category').hidden = true;
  openModal('category-modal');
}

function openCategoryEdit(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  document.getElementById('cat-name').value = cat.name;
  document.getElementById('cat-pricing-mode').value = cat.pricingMode;
  document.getElementById('cat-unit').value = cat.unit;
  document.querySelector('#category-modal .modal-header h2').textContent = 'Категория';
  document.getElementById('btn-save-category').textContent = 'Сохранить';
  document.getElementById('btn-save-category').onclick = async () => {
    await api.put(`/api/categories/${id}`, readCategoryForm());
    closeModal('category-modal');
    await loadAll();
    toast('Категория обновлена');
  };
  const delBtn = document.getElementById('btn-delete-category');
  delBtn.hidden = false;
  delBtn.onclick = async () => {
    const count = state.categories.length;
    if (count <= 1) { toast('Должна остаться хотя бы одна категория', 'error'); return; }
    const itemsInCat = await api.get(`/api/items?categoryId=${id}`);
    const warn = itemsInCat.length
      ? `В категории «${cat.name}» ${itemsInCat.length} позиций — они тоже будут удалены. Продолжить?`
      : `Удалить категорию «${cat.name}»?`;
    if (!confirm(warn)) return;
    for (const it of itemsInCat) await api.del(`/api/items/${it.id}`);
    await api.del(`/api/categories/${id}`);
    closeModal('category-modal');
    if (state.currentCategoryId === id) state.currentCategoryId = null;
    await loadAll();
    toast('Категория удалена');
  };
  openModal('category-modal');
}

function readCategoryForm() {
  return {
    name: document.getElementById('cat-name').value.trim(),
    pricingMode: document.getElementById('cat-pricing-mode').value,
    unit: document.getElementById('cat-unit').value.trim() || 'шт',
  };
}

async function saveNewCategory() {
  const data = readCategoryForm();
  if (!data.name) { toast('Укажите название категории', 'error'); return; }
  const cat = await api.post('/api/categories', data);
  closeModal('category-modal');
  state.currentCategoryId = cat.id;
  await loadAll();
  toast('Категория создана', 'success');
}

// ---- settings modal ----
function openSettings() {
  document.getElementById('set-company').value = state.settings.companyName;
  document.getElementById('set-currency-symbol').value = state.settings.currencySymbol;
  document.getElementById('set-markup').value = state.settings.defaultMarkupPercent;
  openModal('settings-modal');
}
document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const patch = {
    companyName: document.getElementById('set-company').value.trim(),
    currencySymbol: document.getElementById('set-currency-symbol').value.trim(),
    defaultMarkupPercent: Number(document.getElementById('set-markup').value) || 0,
  };
  state.settings = await api.put('/api/settings', patch);
  closeModal('settings-modal');
  renderTable();
  toast('Настройки сохранены', 'success');
});

// ---- activity modal ----
async function openActivity() {
  const list = await api.get('/api/activity?limit=150');
  const body = document.getElementById('activity-body');
  body.innerHTML = list.map((a) => {
    const fr = a.status === 'ok' ? 'green' : a.status === 'error' ? 'red' : a.status === 'reference' ? 'blue' : 'gray';
    return `<tr>
      <td class="muted-cell">${timeAgo(a.at)}</td>
      <td>${escapeHtml(a.itemName || '')}</td>
      <td><span class="badge badge-${fr}">${escapeHtml(a.status)}</span></td>
      <td class="num">${a.price != null ? fmtNum(a.price) : '—'}</td>
      <td class="muted-cell">${escapeHtml(a.message || '')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" class="muted-cell">Обновлений ещё не было.</td></tr>`;
  openModal('activity-modal');
}

// ------------------------------------------------------------ item modal ---
function emptyItem() {
  const cat = currentCategory();
  return {
    id: null,
    categoryId: cat?.id || null,
    subcategory: '', name: '', manufacturer: '', sku: '',
    unit: cat?.unit || 'шт',
    pricingMode: cat?.pricingMode || 'direct',
    priceSheet: null, heightM: null, widthM: null, thicknessMm: null,
    cost: 0, markupPercent: null, retailOverride: null, stockQty: null,
    notes: '', articles: [], links: [], imageUrl: '',
  };
}

// Сжимаем фото на клиенте перед сохранением — оно попадает прямо в позицию
// (в базе, в списке позиций), поэтому держим его небольшим: до 480px по
// длинной стороне, JPEG ~70% — обычно это 15–40 КБ на фото.
const ITEM_PHOTO_MAX_DIM = 480;
const ITEM_PHOTO_QUALITY = 0.72;
function compressItemPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось разобрать изображение'));
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = Math.min(1, ITEM_PHOTO_MAX_DIM / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', ITEM_PHOTO_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

let modalItem = null; // рабочая копия редактируемой позиции

function openItemModal(id) {
  modalItem = id ? { ...state.items.find((i) => i.id === id) } : emptyItem();
  modalItem.files = [];
  state.editingItemId = id || null;
  document.getElementById('item-modal-title').textContent = id ? 'Редактирование позиции' : 'Новая позиция';
  document.getElementById('btn-delete-item').hidden = !id;
  renderItemModalBody();
  openModal('item-modal');
  if (id) {
    api.get(`/api/items/${id}/files`).then((files) => {
      modalItem.files = files;
      renderFilesEditor();
    }).catch(() => {});
  }
}

function renderItemModalBody() {
  const body = document.getElementById('item-modal-body');
  const isSheet = modalItem.pricingMode === 'sheet';
  const symbol = state.settings.currencySymbol;
  const settings = state.settings;

  const pricing = computeClientPricing(modalItem, settings);

  body.innerHTML = `
    <div class="photo-row">
      <div class="photo-thumb-wrap" id="photo-thumb-wrap">
        ${modalItem.imageUrl
          ? `<img class="photo-thumb" id="photo-thumb-img" src="${modalItem.imageUrl}" alt="" />`
          : `<div class="photo-thumb photo-thumb-empty" id="photo-thumb-img">${icon('box', 'icon-lg')}</div>`}
      </div>
      <div class="photo-controls">
        <label class="btn btn-ghost btn-block">
          <span id="photo-upload-label">${modalItem.imageUrl ? 'Заменить фото' : 'Добавить фото'}</span>
          <input type="file" accept="image/*" id="f-photo-file" hidden />
        </label>
        <button type="button" class="btn btn-ghost btn-block" id="btn-photo-clear" ${modalItem.imageUrl ? '' : 'hidden'}>Удалить фото</button>
        <span class="hint">Фото сжимается прямо в браузере, отдельно загружать никуда не нужно.</span>
      </div>
    </div>

    <div class="field-row">
      <label class="field"><span>Название</span><input id="f-name" value="${escapeHtml(modalItem.name)}" placeholder="Например: H1344 ST9 Дуб" /></label>
      <label class="field"><span>Подкатегория / коллекция</span><input id="f-subcategory" value="${escapeHtml(modalItem.subcategory)}" placeholder="Например: EGGER дерево" /></label>
    </div>
    <div class="field-row-3">
      <label class="field"><span>Производитель</span><input id="f-manufacturer" value="${escapeHtml(modalItem.manufacturer)}" /></label>
      <label class="field"><span>Артикул (свой)</span><input id="f-sku" value="${escapeHtml(modalItem.sku)}" /></label>
      <label class="field"><span>Ед. измерения</span><input id="f-unit" value="${escapeHtml(modalItem.unit)}" /></label>
    </div>

    <div class="section-title">
      <span>Ценообразование</span>
      <label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;letter-spacing:0;font-size:12.5px;">
        <input type="checkbox" id="f-pricing-sheet" ${isSheet ? 'checked' : ''} /> плитный материал (по площади листа)
      </label>
    </div>

    ${isSheet ? `
    <div class="field-row-3">
      <label class="field"><span>Цена плиты, ${symbol}</span><input id="f-priceSheet" type="number" step="0.01" value="${modalItem.priceSheet ?? ''}" /></label>
      <label class="field"><span>Высота, м</span><input id="f-heightM" type="number" step="0.001" value="${modalItem.heightM ?? ''}" /></label>
      <label class="field"><span>Ширина, м</span><input id="f-widthM" type="number" step="0.001" value="${modalItem.widthM ?? ''}" /></label>
    </div>
    <div class="field-row">
      <label class="field"><span>Толщина, мм</span><input id="f-thicknessMm" type="number" step="1" value="${modalItem.thicknessMm ?? ''}" /></label>
      <label class="field"><span>Наценка, % (пусто = по умолчанию ${settings.defaultMarkupPercent}%)</span><input id="f-markup" type="number" step="1" value="${modalItem.markupPercent ?? ''}" /></label>
    </div>
    ` : `
    <div class="field-row-3">
      <label class="field"><span>Себестоимость, ${symbol}</span><input id="f-cost" type="number" step="0.01" value="${modalItem.cost ?? 0}" /></label>
      <label class="field"><span>Наценка, % (пусто = по умолчанию ${settings.defaultMarkupPercent}%)</span><input id="f-markup" type="number" step="1" value="${modalItem.markupPercent ?? ''}" /></label>
      <label class="field"><span>Остаток на складе</span><input id="f-stockQty" type="number" step="1" value="${modalItem.stockQty ?? ''}" /></label>
    </div>
    `}

    <div class="computed-box" id="computed-box">
      ${isSheet ? `<div class="stat"><label>Площадь листа</label><strong>${fmtNum(pricing.area, 3)} м²</strong></div>` : ''}
      <div class="stat"><label>Себестоимость / ед.</label><strong>${fmtMoney(pricing.costPerUnit, symbol)}</strong></div>
      <div class="stat"><label>Цена клиенту</label><strong>${fmtMoney(pricing.retailPrice, symbol)}</strong></div>
    </div>
    <label class="field" style="flex-direction:row;align-items:center;gap:8px;">
      <input type="checkbox" id="f-retail-override-toggle" ${modalItem.retailOverride != null ? 'checked' : ''} style="width:auto;" />
      <span style="font-weight:400;">Задать цену клиенту вручную (не пересчитывать автоматически)</span>
    </label>
    <label class="field" id="f-retail-override-wrap" ${modalItem.retailOverride != null ? '' : 'hidden'}>
      <span>Цена клиенту вручную, ${symbol}</span>
      <input id="f-retailOverride" type="number" step="0.01" value="${modalItem.retailOverride ?? ''}" />
    </label>

    <div class="section-title">
      <span>Артикулы у поставщиков</span>
      <button class="btn btn-ghost add-row-btn" id="btn-add-article" type="button">+ артикул</button>
    </div>
    <div class="articles-editor" id="articles-editor"></div>

    <div class="section-title">
      <span>Ссылки на источники (для автообновления цены)</span>
      <button class="btn btn-ghost add-row-btn" id="btn-add-link" type="button">+ ссылка</button>
    </div>
    <div class="links-editor" id="links-editor"></div>

    <div class="section-title">
      <span>Документация</span>
      ${modalItem.id ? `<label class="btn btn-ghost add-row-btn file-btn">+ файл<input type="file" id="f-doc-file" hidden /></label>` : ''}
    </div>
    <div class="files-editor" id="files-editor"></div>

    <label class="field"><span>Примечания</span><textarea id="f-notes" rows="2">${escapeHtml(modalItem.notes)}</textarea></label>
  `;

  renderArticlesEditor();
  renderLinksEditor();
  renderFilesEditor();

  // events
  document.getElementById('f-pricing-sheet').addEventListener('change', (e) => {
    modalItem.pricingMode = e.target.checked ? 'sheet' : 'direct';
    syncFormIntoModalItem();
    renderItemModalBody();
  });
  ['f-priceSheet', 'f-heightM', 'f-widthM', 'f-cost', 'f-markup'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { syncFormIntoModalItem(); refreshComputedBox(); });
  });
  const toggle = document.getElementById('f-retail-override-toggle');
  toggle.addEventListener('change', () => {
    document.getElementById('f-retail-override-wrap').hidden = !toggle.checked;
    if (!toggle.checked) { modalItem.retailOverride = null; refreshComputedBox(); }
  });
  const overrideInput = document.getElementById('f-retailOverride');
  if (overrideInput) overrideInput.addEventListener('input', () => { syncFormIntoModalItem(); refreshComputedBox(); });

  document.getElementById('f-photo-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const label = document.getElementById('photo-upload-label');
    const prevLabel = label.textContent;
    label.textContent = 'Обработка…';
    try {
      const dataUrl = await compressItemPhoto(file);
      modalItem.imageUrl = dataUrl;
      updatePhotoPreview();
    } catch (err) {
      toast(err.message || 'Не удалось обработать фото', 'error');
      label.textContent = prevLabel;
    }
  });
  document.getElementById('btn-photo-clear').addEventListener('click', () => {
    modalItem.imageUrl = '';
    updatePhotoPreview();
  });

  const docFileInput = document.getElementById('f-doc-file');
  if (docFileInput) docFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    uploadItemDocFile(file);
    e.target.value = '';
  });

  document.getElementById('btn-add-article').addEventListener('click', () => {
    modalItem.articles = [...(modalItem.articles || []), { label: '', value: '' }];
    renderArticlesEditor();
  });
  document.getElementById('btn-add-link').addEventListener('click', () => {
    modalItem.links = [...(modalItem.links || []), { id: 'new-' + Math.random().toString(36).slice(2, 8), url: '', label: '', autoParse: true, status: 'pending' }];
    renderLinksEditor();
  });
}

function updatePhotoPreview() {
  const wrap = document.getElementById('photo-thumb-wrap');
  wrap.innerHTML = modalItem.imageUrl
    ? `<img class="photo-thumb" id="photo-thumb-img" src="${modalItem.imageUrl}" alt="" />`
    : `<div class="photo-thumb photo-thumb-empty" id="photo-thumb-img">${icon('box', 'icon-lg')}</div>`;
  document.getElementById('photo-upload-label').textContent = modalItem.imageUrl ? 'Заменить фото' : 'Добавить фото';
  document.getElementById('btn-photo-clear').hidden = !modalItem.imageUrl;
}

function refreshComputedBox() {
  const pricing = computeClientPricing(modalItem, state.settings);
  const symbol = state.settings.currencySymbol;
  const isSheet = modalItem.pricingMode === 'sheet';
  document.getElementById('computed-box').innerHTML = `
    ${isSheet ? `<div class="stat"><label>Площадь листа</label><strong>${fmtNum(pricing.area, 3)} м²</strong></div>` : ''}
    <div class="stat"><label>Себестоимость / ед.</label><strong>${fmtMoney(pricing.costPerUnit, symbol)}</strong></div>
    <div class="stat"><label>Цена клиенту</label><strong>${fmtMoney(pricing.retailPrice, symbol)}</strong></div>
  `;
}

function computeClientPricing(item, settings) {
  const markup = item.markupPercent ?? settings.defaultMarkupPercent;
  let cost = Number(item.cost) || 0;
  let area = null;
  if (item.pricingMode === 'sheet') {
    const h = Number(item.heightM) || 0, w = Number(item.widthM) || 0;
    area = h && w ? +(h * w).toFixed(4) : 0;
    cost = area > 0 ? (Number(item.priceSheet) || 0) / area : 0;
  }
  const retail = item.retailOverride != null ? Number(item.retailOverride) : +(cost * (1 + markup / 100)).toFixed(2);
  return { area, costPerUnit: +cost.toFixed(4), retailPrice: retail };
}

function renderArticlesEditor() {
  const wrap = document.getElementById('articles-editor');
  const list = modalItem.articles || [];
  wrap.innerHTML = list.length ? '' : `<span class="muted">Артикулов пока нет.</span>`;
  list.forEach((a, idx) => {
    const row = document.createElement('div');
    row.className = 'article-edit-row';
    row.innerHTML = `
      <input placeholder="Поставщик (LTB, Blum…)" value="${escapeHtml(a.label)}" data-art-field="label" />
      <input placeholder="Артикул" value="${escapeHtml(a.value)}" data-art-field="value" />
      <button class="remove-row-btn" type="button" title="Удалить">${icon('close')}</button>
    `;
    row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', (e) => {
      list[idx][e.target.dataset.artField] = e.target.value;
    }));
    row.querySelector('.remove-row-btn').addEventListener('click', () => {
      modalItem.articles = list.filter((_, i) => i !== idx);
      renderArticlesEditor();
    });
    wrap.appendChild(row);
  });
}

function renderLinksEditor() {
  const wrap = document.getElementById('links-editor');
  const list = modalItem.links || [];
  wrap.innerHTML = list.length ? '' : `<span class="muted">Ссылок пока нет — добавьте, чтобы включить автообновление цены.</span>`;
  list.forEach((l, idx) => {
    const fr = linkFreshness(l);
    const row = document.createElement('div');
    row.className = 'link-edit-row';
    row.innerHTML = `
      <span class="link-status-dot" style="background:var(--${fr.cls}-fg)" title="${fr.label}"></span>
      <input placeholder="https://…" value="${escapeHtml(l.url)}" data-link-field="url" />
      <input placeholder="Метка (необязательно)" value="${escapeHtml(l.label || '')}" data-link-field="label" style="max-width:140px;" />
      <button class="link-parse-btn" type="button" title="Проверить цену сейчас">${icon('refresh')}</button>
      <button class="remove-row-btn" type="button" title="Удалить">${icon('close')}</button>
    `;
    row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', (e) => {
      list[idx][e.target.dataset.linkField] = e.target.value;
    }));
    row.querySelector('.remove-row-btn').addEventListener('click', () => {
      modalItem.links = list.filter((_, i) => i !== idx);
      renderLinksEditor();
    });
    row.querySelector('.link-parse-btn').addEventListener('click', async (e) => {
      if (!modalItem.id || l.id.startsWith('new-')) { toast('Сначала сохраните позицию, затем можно проверить ссылку', ''); return; }
      e.target.classList.add('spinning');
      try {
        const { result, item } = await api.post(`/api/items/${modalItem.id}/links/${l.id}/parse`);
        modalItem = { ...item };
        renderLinksEditor();
        refreshComputedBox();
        toast(result.status === 'ok' ? `Найдена цена: ${fmtNum(result.price)}` : (result.message || 'Цена не найдена'), result.status === 'ok' ? 'success' : '');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    wrap.appendChild(row);
  });
}

// Иконка по типу файла — просто по расширению, без лишней возни.
function fileIcon(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'box';
  return 'download';
}

function renderFilesEditor() {
  const wrap = document.getElementById('files-editor');
  if (!wrap) return;
  if (!modalItem.id) {
    wrap.innerHTML = `<span class="muted">Сохраните позицию, чтобы прикреплять файлы документации.</span>`;
    return;
  }
  const list = modalItem.files || [];
  wrap.innerHTML = list.length ? '' : `<span class="muted">Файлов пока нет.</span>`;
  list.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <span class="file-row-icon">${icon(fileIcon(f.filename))}</span>
      <a href="/api/item-files/${f.id}" download="${escapeHtml(f.filename)}" rel="noopener" class="file-row-name" title="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</a>
      <span class="file-row-size">${fmtBytes(f.size)}</span>
      <button class="remove-row-btn" type="button" title="Удалить файл">${icon('close')}</button>
    `;
    row.querySelector('.remove-row-btn').addEventListener('click', async () => {
      if (!confirm(`Удалить файл «${f.filename}»?`)) return;
      try {
        await api.del(`/api/item-files/${f.id}`);
        modalItem.files = (modalItem.files || []).filter((x) => x.id !== f.id);
        renderFilesEditor();
        toast('Файл удалён');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    wrap.appendChild(row);
  });
}

async function uploadItemDocFile(file) {
  const label = document.querySelector('#item-modal-body .add-row-btn.file-btn');
  const prevText = label ? label.firstChild.textContent : '';
  if (label) label.firstChild.textContent = 'Загрузка…';
  try {
    const buf = await file.arrayBuffer();
    const res = await fetch(`/api/items/${modalItem.id}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
      body: buf,
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Не удалось загрузить файл'); }
    const meta = await res.json();
    modalItem.files = [...(modalItem.files || []), meta];
    renderFilesEditor();
    toast('Файл добавлен', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (label) label.firstChild.textContent = prevText;
  }
}

function syncFormIntoModalItem() {
  const val = (id) => document.getElementById(id)?.value;
  const num = (id) => { const v = val(id); return v === '' || v == null ? null : Number(v); };
  modalItem.name = val('f-name') ?? modalItem.name;
  modalItem.subcategory = val('f-subcategory') ?? modalItem.subcategory;
  modalItem.manufacturer = val('f-manufacturer') ?? modalItem.manufacturer;
  modalItem.sku = val('f-sku') ?? modalItem.sku;
  modalItem.unit = val('f-unit') ?? modalItem.unit;
  modalItem.notes = document.getElementById('f-notes')?.value ?? modalItem.notes;

  if (modalItem.pricingMode === 'sheet') {
    modalItem.priceSheet = num('f-priceSheet');
    modalItem.heightM = num('f-heightM');
    modalItem.widthM = num('f-widthM');
    modalItem.thicknessMm = num('f-thicknessMm');
  } else {
    modalItem.cost = num('f-cost') ?? 0;
    modalItem.stockQty = num('f-stockQty');
  }
  modalItem.markupPercent = num('f-markup');
  const overrideOn = document.getElementById('f-retail-override-toggle')?.checked;
  modalItem.retailOverride = overrideOn ? num('f-retailOverride') : null;
}

document.getElementById('btn-save-item').addEventListener('click', async () => {
  syncFormIntoModalItem();
  if (!modalItem.name.trim()) { toast('Укажите название позиции', 'error'); return; }
  modalItem.links = (modalItem.links || []).filter((l) => l.url.trim()).map((l) => ({ ...l, id: l.id.startsWith('new-') ? undefined : l.id }));
  modalItem.articles = (modalItem.articles || []).filter((a) => a.label.trim() || a.value.trim());

  const payload = { ...modalItem };
  delete payload.area; delete payload.costPerUnit; delete payload.retailPrice; delete payload.priceHistory;

  try {
    if (modalItem.id) {
      await api.put(`/api/items/${modalItem.id}`, payload);
      // ссылки без id (новые) — досоздаём отдельно, PUT только обновляет существующий массив,
      // но т.к. мы передаём весь массив включая url без id, добавим id на сервере вручную ниже.
    } else {
      await api.post('/api/items', payload);
    }
    closeModal('item-modal');
    await loadItems();
    renderTable();
    countItemsPerCategory();
    toast('Сохранено', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('btn-delete-item').addEventListener('click', async () => {
  if (!modalItem.id) return;
  if (!confirm('Удалить эту позицию из прайс-листа?')) return;
  await api.del(`/api/items/${modalItem.id}`);
  closeModal('item-modal');
  await loadItems();
  renderTable();
  countItemsPerCategory();
  toast('Позиция удалена');
});

// ------------------------------------------------------------- top-level ---
document.getElementById('btn-add-category').addEventListener('click', openCategoryCreate);
document.getElementById('btn-open-settings').addEventListener('click', openSettings);
document.getElementById('btn-open-activity').addEventListener('click', openActivity);
document.getElementById('btn-add-item').addEventListener('click', () => openItemModal(null));
document.getElementById('btn-add-item-empty').addEventListener('click', () => openItemModal(null));
document.getElementById('btn-bulk-parse').addEventListener('click', bulkParseCurrentCategory);
document.getElementById('btn-export').addEventListener('click', () => { window.location.href = '/api/export/xlsx'; });

document.getElementById('search-input').addEventListener('input', debounce((e) => {
  state.search = e.target.value;
  renderTable();
}, 150));

document.getElementById('import-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  try {
    const res = await fetch('/api/import/xlsx', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: buf });
    if (!res.ok) throw new Error((await res.json()).error || 'Ошибка импорта');
    const summary = await res.json();
    toast(`Импортировано: ${summary.itemsCreated} позиций из ${summary.sheetsProcessed} листов`, 'success');
    await loadAll();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    e.target.value = '';
  }
});

// ------------------------------------------------------------------ init ---
loadAll().catch((err) => {
  console.error(err);
  toast('Не удалось загрузить данные: ' + err.message, 'error');
});
