// АРТЕКО — прайс услуг для монтажников + генератор ТЗ по монтажу. Vanilla JS, без сборки.
// Отдельная страница/модуль от public/js/app.js (материалы) — общий только
// внешний вид (styles.css) и часть API-соглашений (/api/settings и т.п.).

const ICONS = {
  box: '<path d="M3 8 12 3 21 8 21 17 12 22 3 17Z"/><path d="M3 8 12 13 21 8"/><path d="M12 13V22"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3A1 1 0 0 1 10 2H14A1 1 0 0 1 15 3V4"/><path d="M9 10H15"/><path d="M9 14H15"/>',
  plug: '<path d="M9 3V8"/><path d="M15 3V8"/><path d="M6 8H18V13A6 6 0 0 1 6 13Z"/><path d="M12 19V22"/>',
  wrench: '<path d="M14.7 6.3A4 4 0 1 0 9 12L3 18 6 21 12 15A4 4 0 0 0 17.7 9.3Z"/>',
  bolt: '<rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 10 12 4 21 10"/>',
  sofa: '<path d="M5 12V8A2 2 0 0 1 7 6H17A2 2 0 0 1 19 8V12"/><rect x="3" y="12" width="18" height="6" rx="1.5"/><path d="M5 18V20.5"/><path d="M19 18V20.5"/>',
  plus: '<path d="M12 4V20"/><path d="M4 12H20"/>',
  edit: '<path d="M4 20 4.8 16.6 15.5 5.9A2 2 0 0 1 18.3 5.9L18.5 6.1A2 2 0 0 1 18.5 8.9L7.8 19.6Z"/><path d="M13.8 7.6 16.4 10.2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15H4A1 1 0 0 1 3 14V4A1 1 0 0 1 4 3H14A1 1 0 0 1 15 4V5"/>',
  trash: '<path d="M4 7H20"/><path d="M9 7V4.5A1 1 0 0 1 10 3.5H14A1 1 0 0 1 15 4.5V7"/><path d="M6 7 7 20A1.2 1.2 0 0 0 8.2 21H15.8A1.2 1.2 0 0 0 17 20L18 7"/>',
  link: '<path d="M14 4H20V10"/><path d="M20 4 11 13"/><path d="M18 14V19A1 1 0 0 1 17 20H5A1 1 0 0 1 4 19V7A1 1 0 0 1 5 6H10"/>',
  close: '<path d="M5 5 19 19"/><path d="M19 5 5 19"/>',
  file: '<path d="M7 3H14L18 7V20A1 1 0 0 1 17 21H7A1 1 0 0 1 6 20V4A1 1 0 0 1 7 3Z"/><path d="M14 3V7H18"/>',
  sliders: '<path d="M4 7H20"/><circle cx="9" cy="7" r="2"/><path d="M4 17H20"/><circle cx="15" cy="17" r="2"/>',
};
function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.box}</svg>`;
}

// ---------------------------------------------------------------- state ---
const state = {
  settings: null,
  categories: [],
  allServices: [],
  currentCategoryId: null, // фильтр для вкладки "Прайс услуг"
  view: 'builder',
  proposals: [],
  proposal: emptyProposal(),
};

function emptyProposal() {
  return {
    id: null, shareToken: null, number: null,
    title: '', clientName: '', clientPhone: '', objectAddress: '',
    installerName: '', installerPhone: '', projectAmount: null, notes: '',
    status: 'draft', items: [], files: [], createdAt: null,
  };
}

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
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function symbol() { return state.settings?.servicesCurrencySymbol || '₾'; }

// Совпадает по формуле с server/data/services-repo.js computeLineAmount —
// пересчитываем на клиенте сразу при вводе, не дожидаясь ответа сервера.
function computeLineAmount(line) {
  const unitPrice = Number(line.unitPrice) || 0;
  const qty = line.qty == null || line.qty === '' ? 1 : Number(line.qty) || 0;
  if (line.priceType === 'percent') {
    const base = Number(line.percentBase) || 0;
    return +(base * (unitPrice / 100) * qty).toFixed(2);
  }
  return +(unitPrice * qty).toFixed(2);
}
function proposalTotal(items) {
  return items.reduce((s, it) => s + computeLineAmount(it), 0);
}
function priceTypeLabel(t) {
  return { fixed: 'Фиксированная', from: 'От (минимум)', percent: '% от суммы', custom: 'Договорная' }[t] || t;
}
function formatServicePrice(svc) {
  const sym = symbol();
  if (svc.priceType === 'percent') return `${fmtNum(svc.price, 2)}%`;
  if (svc.priceType === 'custom') return 'договорная';
  if (svc.priceType === 'from') return `от ${fmtMoney(svc.price, sym)}`;
  return fmtMoney(svc.price, sym);
}

// ------------------------------------------------------------------ load ---
async function loadShared() {
  const [settings, categories, allServices] = await Promise.all([
    api.get('/api/settings'),
    api.get('/api/service-categories'),
    api.get('/api/services'),
  ]);
  state.settings = settings;
  state.categories = categories.sort((a, b) => a.sortOrder - b.sortOrder);
  state.allServices = allServices;
  if (!state.currentCategoryId && categories.length) state.currentCategoryId = categories[0].id;
  renderSidebar();
  renderCompanyName();
}

function renderCompanyName() {
  document.getElementById('kp-company-name').textContent = state.settings?.companyName || 'АРТЕКО';
}

// --------------------------------------------------------------- sidebar ---
function renderSidebar() {
  const list = document.getElementById('category-list');
  list.innerHTML = '';
  const allBtn = document.createElement('div');
  allBtn.className = 'category-item' + (state.currentCategoryId === null ? ' active' : '');
  allBtn.innerHTML = `<span class="cat-icon">${icon('sliders')}</span><span class="cat-name">Все категории</span>`;
  allBtn.addEventListener('click', () => { state.currentCategoryId = null; renderSidebar(); renderCatalog(); });
  list.appendChild(allBtn);

  for (const cat of state.categories) {
    const el = document.createElement('div');
    el.className = 'category-item' + (cat.id === state.currentCategoryId ? ' active' : '');
    el.innerHTML = `
      <span class="cat-icon">${icon(cat.icon || 'box')}</span>
      <span class="cat-name">${escapeHtml(cat.name)}</span>
      <span class="cat-edit" data-edit-cat="${cat.id}" title="Редактировать категорию">${icon('edit')}</span>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-cat]')) return;
      state.currentCategoryId = cat.id;
      renderSidebar();
      renderCatalog();
    });
    list.appendChild(el);
  }
  list.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    btn.addEventListener('click', () => openCategoryEdit(btn.dataset.editCat));
  });
}

// ------------------------------------------------------------------ views ---
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.view-tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  document.getElementById('view-catalog').hidden = view !== 'catalog';
  document.getElementById('view-builder').hidden = view !== 'builder';
  document.getElementById('view-list').hidden = view !== 'list';
  renderTopbarActions();
  if (view === 'catalog') renderCatalog();
  if (view === 'list') renderProposalsList();
}
function renderTopbarActions() {
  const wrap = document.getElementById('topbar-actions');
  if (state.view === 'catalog') {
    wrap.innerHTML = `<button class="btn btn-primary" id="btn-add-service">${icon('plus')} Услугу</button>`;
    document.getElementById('btn-add-service').addEventListener('click', () => openServiceCreate());
  } else {
    wrap.innerHTML = '';
  }
}
document.querySelectorAll('.view-tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));

// ----------------------------------------------------------------- catalog ---
function renderCatalog() {
  const body = document.getElementById('services-table-body');
  const empty = document.getElementById('services-empty');
  let list = state.allServices;
  if (state.currentCategoryId) list = list.filter((s) => s.categoryId === state.currentCategoryId);
  list = [...list].sort((a, b) => a.sortOrder - b.sortOrder);

  empty.hidden = list.length > 0;
  body.innerHTML = list.map((s) => `
    <tr data-service-id="${s.id}">
      <td class="name-cell">${escapeHtml(s.name)}</td>
      <td><span class="badge badge-blue">${escapeHtml(priceTypeLabel(s.priceType))}</span></td>
      <td class="num"><strong>${formatServicePrice(s)}</strong></td>
      <td class="muted-cell">${escapeHtml(s.unit)}</td>
      <td class="muted-cell">${escapeHtml(s.note || '—')}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost" data-edit-svc="${s.id}" title="Редактировать">${icon('edit')}</button>
          <button class="btn btn-icon btn-ghost" data-del-svc="${s.id}" title="Удалить">${icon('trash')}</button>
        </div>
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-edit-svc]').forEach((b) => b.addEventListener('click', () => openServiceEdit(b.dataset.editSvc)));
  body.querySelectorAll('[data-del-svc]').forEach((b) => b.addEventListener('click', () => deleteService(b.dataset.delSvc)));

  document.getElementById('services-notice-box').textContent = state.settings?.servicesNotice || '';
}

async function deleteService(id) {
  if (!confirm('Удалить эту услугу из прайса?')) return;
  await api.del(`/api/services/${id}`);
  state.allServices = state.allServices.filter((s) => s.id !== id);
  renderCatalog();
  toast('Услуга удалена');
}

// ---- service modal ----
function fillCategorySelect(selectEl, selectedId) {
  selectEl.innerHTML = state.categories.map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
}
function togglePriceTypeUI() {
  const type = document.getElementById('svc-price-type').value;
  const wrap = document.getElementById('svc-price-wrap');
  const priceInput = document.getElementById('svc-price');
  const labels = { fixed: 'Цена, ₾', from: 'Минимальная цена, ₾', percent: 'Процент, %', custom: 'Не требуется' };
  wrap.querySelector('span').textContent = labels[type] || 'Значение';
  wrap.hidden = type === 'custom';
  if (type === 'custom') priceInput.value = '';
}
document.getElementById('svc-price-type').addEventListener('change', togglePriceTypeUI);

let editingServiceId = null;
function openServiceCreate() {
  editingServiceId = null;
  document.getElementById('service-modal-title').textContent = 'Новая услуга';
  document.getElementById('svc-name').value = '';
  fillCategorySelect(document.getElementById('svc-category'), state.currentCategoryId || state.categories[0]?.id);
  document.getElementById('svc-price-type').value = 'fixed';
  document.getElementById('svc-price').value = '';
  document.getElementById('svc-unit').value = 'шт';
  document.getElementById('svc-note').value = '';
  document.getElementById('btn-delete-service').hidden = true;
  togglePriceTypeUI();
  openModal('service-modal');
}
function openServiceEdit(id) {
  const s = state.allServices.find((x) => x.id === id);
  if (!s) return;
  editingServiceId = id;
  document.getElementById('service-modal-title').textContent = 'Редактирование услуги';
  document.getElementById('svc-name').value = s.name;
  fillCategorySelect(document.getElementById('svc-category'), s.categoryId);
  document.getElementById('svc-price-type').value = s.priceType;
  document.getElementById('svc-price').value = s.price ?? '';
  document.getElementById('svc-unit').value = s.unit;
  document.getElementById('svc-note').value = s.note || '';
  document.getElementById('btn-delete-service').hidden = false;
  togglePriceTypeUI();
  openModal('service-modal');
}
document.getElementById('btn-save-service').addEventListener('click', async () => {
  const name = document.getElementById('svc-name').value.trim();
  if (!name) { toast('Укажите название услуги', 'error'); return; }
  const priceType = document.getElementById('svc-price-type').value;
  const priceRaw = document.getElementById('svc-price').value;
  const payload = {
    name,
    categoryId: document.getElementById('svc-category').value || null,
    priceType,
    price: priceType === 'custom' || priceRaw === '' ? null : Number(priceRaw),
    unit: document.getElementById('svc-unit').value.trim() || 'шт',
    note: document.getElementById('svc-note').value.trim(),
  };
  try {
    if (editingServiceId) {
      const updated = await api.put(`/api/services/${editingServiceId}`, payload);
      state.allServices = state.allServices.map((s) => (s.id === editingServiceId ? updated : s));
    } else {
      const created = await api.post('/api/services', payload);
      state.allServices.push(created);
    }
    closeModal('service-modal');
    renderCatalog();
    toast('Сохранено', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});
document.getElementById('btn-delete-service').addEventListener('click', async () => {
  if (!editingServiceId) return;
  closeModal('service-modal');
  await deleteService(editingServiceId);
});

// ---- category modal ----
function openCategoryCreate() {
  document.getElementById('cat-name').value = '';
  document.querySelector('#category-modal .modal-header h2').textContent = 'Новая категория услуг';
  document.getElementById('btn-save-category').textContent = 'Создать';
  document.getElementById('btn-save-category').onclick = saveNewCategory;
  document.getElementById('btn-delete-category').hidden = true;
  openModal('category-modal');
}
function openCategoryEdit(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  document.getElementById('cat-name').value = cat.name;
  document.querySelector('#category-modal .modal-header h2').textContent = 'Категория услуг';
  document.getElementById('btn-save-category').textContent = 'Сохранить';
  document.getElementById('btn-save-category').onclick = async () => {
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { toast('Укажите название', 'error'); return; }
    await api.put(`/api/service-categories/${id}`, { name });
    closeModal('category-modal');
    await loadShared();
    renderCatalog();
    toast('Категория обновлена');
  };
  const delBtn = document.getElementById('btn-delete-category');
  delBtn.hidden = false;
  delBtn.onclick = async () => {
    const inCat = state.allServices.filter((s) => s.categoryId === id);
    const warn = inCat.length
      ? `В категории «${cat.name}» ${inCat.length} услуг — они тоже будут удалены. Продолжить?`
      : `Удалить категорию «${cat.name}»?`;
    if (!confirm(warn)) return;
    for (const s of inCat) await api.del(`/api/services/${s.id}`);
    await api.del(`/api/service-categories/${id}`);
    closeModal('category-modal');
    if (state.currentCategoryId === id) state.currentCategoryId = null;
    await loadShared();
    renderCatalog();
    toast('Категория удалена');
  };
  openModal('category-modal');
}
async function saveNewCategory() {
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { toast('Укажите название', 'error'); return; }
  const cat = await api.post('/api/service-categories', { name, icon: 'box' });
  closeModal('category-modal');
  state.currentCategoryId = cat.id;
  await loadShared();
  renderCatalog();
  toast('Категория создана', 'success');
}
document.getElementById('btn-add-category').addEventListener('click', openCategoryCreate);

// ---- settings modal ----
function openSettings() {
  document.getElementById('set-currency-symbol').value = state.settings.servicesCurrencySymbol;
  document.getElementById('set-notice').value = state.settings.servicesNotice;
  openModal('settings-modal');
}
document.getElementById('btn-open-settings').addEventListener('click', openSettings);
document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const patch = {
    servicesCurrencySymbol: document.getElementById('set-currency-symbol').value.trim() || '₾',
    servicesNotice: document.getElementById('set-notice').value,
  };
  state.settings = await api.put('/api/settings', patch);
  closeModal('settings-modal');
  renderCatalog();
  renderLines();
  toast('Настройки сохранены', 'success');
});

// -------------------------------------------------------------- modals ----
function openModal(id) { document.getElementById(`${id}-backdrop`).hidden = false; }
function closeModal(id) { document.getElementById(`${id}-backdrop`).hidden = true; }
document.querySelectorAll('[data-close-modal]').forEach((el) => {
  el.addEventListener('click', () => closeModal(el.dataset.closeModal));
});
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.hidden = true; });
});

// =================================================================== ТЗ ===
const FIELD_IDS = ['title', 'clientName', 'clientPhone', 'objectAddress', 'installerName', 'installerPhone', 'projectAmount', 'notes'];

function fillFieldsFromProposal() {
  document.getElementById('f-title').value = state.proposal.title || '';
  document.getElementById('f-clientName').value = state.proposal.clientName || '';
  document.getElementById('f-clientPhone').value = state.proposal.clientPhone || '';
  document.getElementById('f-objectAddress').value = state.proposal.objectAddress || '';
  document.getElementById('f-installerName').value = state.proposal.installerName || '';
  document.getElementById('f-installerPhone').value = state.proposal.installerPhone || '';
  document.getElementById('f-projectAmount').value = state.proposal.projectAmount ?? '';
  document.getElementById('f-notes').value = state.proposal.notes || '';
}
function syncFieldsIntoProposal() {
  state.proposal.title = document.getElementById('f-title').value.trim();
  state.proposal.clientName = document.getElementById('f-clientName').value.trim();
  state.proposal.clientPhone = document.getElementById('f-clientPhone').value.trim();
  state.proposal.objectAddress = document.getElementById('f-objectAddress').value.trim();
  state.proposal.installerName = document.getElementById('f-installerName').value.trim();
  state.proposal.installerPhone = document.getElementById('f-installerPhone').value.trim();
  const pa = document.getElementById('f-projectAmount').value;
  state.proposal.projectAmount = pa === '' ? null : Number(pa);
  state.proposal.notes = document.getElementById('f-notes').value;
}
FIELD_IDS.forEach((f) => document.getElementById(`f-${f}`).addEventListener('input', debounce(syncFieldsIntoProposal, 200)));

function renderSheetMeta() {
  document.getElementById('kp-number').textContent = state.proposal.id ? state.proposal.number : 'Черновик (не сохранён)';
  document.getElementById('kp-date').textContent = fmtDate(state.proposal.createdAt) || fmtDate(new Date().toISOString());
  document.getElementById('btn-kp-share').disabled = !state.proposal.id;
  document.getElementById('kp-sheet-notice').textContent = state.settings?.servicesNotice || '';
}

// ---- поиск услуги для добавления строки ----
const searchInput = document.getElementById('kp-service-search');
const suggestBox = document.getElementById('kp-suggest');

searchInput.addEventListener('input', debounce(() => renderSuggest(searchInput.value.trim().toLowerCase()), 100));
searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) renderSuggest(searchInput.value.trim().toLowerCase()); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('.kp-add-service')) suggestBox.hidden = true;
});

function renderSuggest(query) {
  if (!query) { suggestBox.hidden = true; return; }
  const catName = (id) => state.categories.find((c) => c.id === id)?.name || '';
  const matches = state.allServices
    .filter((s) => s.name.toLowerCase().includes(query))
    .slice(0, 40);

  if (matches.length === 0) {
    suggestBox.innerHTML = `<div class="kp-suggest-empty">Ничего не найдено — можно завести новую услугу на вкладке «Прайс услуг».</div>`;
    suggestBox.hidden = false;
    return;
  }
  // группировка по категории, сохраняя порядок появления
  const groups = [];
  const idx = new Map();
  for (const s of matches) {
    const key = catName(s.categoryId) || 'Без категории';
    if (!idx.has(key)) { idx.set(key, groups.length); groups.push({ key, items: [] }); }
    groups[idx.get(key)].items.push(s);
  }
  suggestBox.innerHTML = groups.map((g) => `
    <div class="kp-suggest-group">${escapeHtml(g.key)}</div>
    ${g.items.map((s) => `
      <div class="kp-suggest-item" data-add-service="${s.id}">
        <span class="sname">${escapeHtml(s.name)}</span>
        <span class="sprice">${formatServicePrice(s)} · ${escapeHtml(s.unit)}</span>
      </div>`).join('')}
  `).join('');
  suggestBox.querySelectorAll('[data-add-service]').forEach((row) => {
    row.addEventListener('click', () => {
      addLineFromService(row.dataset.addService);
      searchInput.value = '';
      suggestBox.hidden = true;
      searchInput.focus();
    });
  });
  suggestBox.hidden = false;
}

function addLineFromService(serviceId) {
  const svc = state.allServices.find((s) => s.id === serviceId);
  if (!svc) return;
  const line = {
    _localId: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    serviceId: svc.id,
    name: svc.name,
    unit: svc.unit,
    priceType: svc.priceType,
    unitPrice: svc.priceType === 'custom' ? 0 : (svc.price ?? 0),
    qty: 1,
    percentBase: state.proposal.projectAmount || 0,
    note: svc.note || '',
  };
  state.proposal.items.push(line);
  renderLines();
}

function renderLines() {
  const body = document.getElementById('kp-lines-body');
  const empty = document.getElementById('kp-lines-empty');
  const items = state.proposal.items;
  empty.hidden = items.length > 0;
  document.getElementById('kp-lines-table').hidden = items.length === 0;

  body.innerHTML = items.map((it, i) => {
    const isPercent = it.priceType === 'percent';
    return `
    <tr data-line="${i}">
      <td class="kp-line-name">
        ${escapeHtml(it.name)}
        <span class="kp-line-unit">${escapeHtml(it.unit)}${it.priceType === 'custom' ? ' · договорная' : ''}${it.priceType === 'from' ? ' · цена «от»' : ''}</span>
        ${it.note ? `<span class="kp-line-note">${escapeHtml(it.note)}</span>` : ''}
      </td>
      <td class="num"><input type="number" step="0.01" data-line-field="unitPrice" value="${it.unitPrice}" title="${isPercent ? 'Процент, %' : `Цена за ед., ${symbol()}`}" /></td>
      <td class="num"><input type="number" step="0.01" data-line-field="${isPercent ? 'percentBase' : 'qty'}" value="${isPercent ? it.percentBase : it.qty}" title="${isPercent ? `База для %, ${symbol()}` : 'Количество'}" /></td>
      <td class="num"><strong>${fmtMoney(computeLineAmount(it), symbol())}</strong></td>
      <td><button class="btn btn-icon btn-ghost" data-remove-line="${i}" title="Удалить строку">${icon('close')}</button></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('[data-line-field]').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const row = e.target.closest('tr');
      const i = Number(row.dataset.line);
      state.proposal.items[i][e.target.dataset.lineField] = Number(e.target.value) || 0;
      row.querySelector('.num strong').textContent = fmtMoney(computeLineAmount(state.proposal.items[i]), symbol());
      renderTotal();
    });
  });
  body.querySelectorAll('[data-remove-line]').forEach((b) => {
    b.addEventListener('click', () => {
      state.proposal.items.splice(Number(b.dataset.removeLine), 1);
      renderLines();
      renderTotal();
    });
  });
  renderTotal();
}
function renderTotal() {
  document.getElementById('kp-total').textContent = fmtMoney(proposalTotal(state.proposal.items), symbol());
}

// ---- файлы ----
function renderFiles() {
  const wrap = document.getElementById('kp-files-list');
  const files = state.proposal.files || [];
  if (!files.length) { wrap.innerHTML = `<span class="kp-files-empty">Файлы не приложены — чертежи, эскизы можно добавить кнопкой «+ Файл» выше.</span>`; return; }
  wrap.innerHTML = files.map((f) => `
    <div class="kp-file-row" data-file-id="${f.id}">
      <span class="kp-file-icon">${icon('file')}</span>
      <a href="/api/proposal-files/${f.id}" target="_blank" rel="noopener">${escapeHtml(f.filename)}</a>
      <span class="kp-file-size">${fmtBytes(f.size)}</span>
      <button class="btn btn-icon btn-ghost" data-remove-file="${f.id}" title="Удалить файл">${icon('close')}</button>
    </div>`).join('');
  wrap.querySelectorAll('[data-remove-file]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (!confirm('Удалить файл?')) return;
      await api.del(`/api/proposal-files/${b.dataset.removeFile}`);
      state.proposal.files = state.proposal.files.filter((f) => f.id !== b.dataset.removeFile);
      renderFiles();
      toast('Файл удалён');
    });
  });
}

document.getElementById('kp-file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  try {
    await ensureProposalSaved();
    for (const file of files) {
      const meta = await fetch(`/api/proposals/${state.proposal.id}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
        },
        body: file,
      }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Не удалось загрузить файл');
        return res.json();
      });
      state.proposal.files.push(meta);
    }
    renderFiles();
    toast(`Загружено файлов: ${files.length}`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    e.target.value = '';
  }
});

// ---- сохранение / шаринг / печать ----
function buildProposalPayload() {
  syncFieldsIntoProposal();
  return {
    title: state.proposal.title,
    clientName: state.proposal.clientName,
    clientPhone: state.proposal.clientPhone,
    objectAddress: state.proposal.objectAddress,
    installerName: state.proposal.installerName,
    installerPhone: state.proposal.installerPhone,
    projectAmount: state.proposal.projectAmount,
    notes: state.proposal.notes,
    status: state.proposal.status || 'draft',
    items: state.proposal.items.map((it) => ({
      serviceId: it.serviceId, name: it.name, unit: it.unit, priceType: it.priceType,
      unitPrice: it.unitPrice, qty: it.qty, percentBase: it.percentBase, note: it.note,
    })),
  };
}
async function ensureProposalSaved() {
  const payload = buildProposalPayload();
  if (!state.proposal.id) {
    const created = await api.post('/api/proposals', payload);
    Object.assign(state.proposal, created);
  } else {
    const updated = await api.put(`/api/proposals/${state.proposal.id}`, payload);
    Object.assign(state.proposal, updated);
  }
  renderSheetMeta();
  return state.proposal.id;
}
document.getElementById('btn-kp-save').addEventListener('click', async () => {
  try {
    await ensureProposalSaved();
    toast('ТЗ сохранено', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});
document.getElementById('btn-kp-share').addEventListener('click', async () => {
  try {
    if (!state.proposal.id) await ensureProposalSaved();
    const link = `${location.origin}/p.html?token=${state.proposal.shareToken}`;
    document.getElementById('share-link-input').value = link;
    openModal('share-modal');
  } catch (err) {
    toast(err.message, 'error');
  }
});
document.getElementById('btn-copy-share-link').addEventListener('click', async () => {
  const input = document.getElementById('share-link-input');
  try {
    await navigator.clipboard.writeText(input.value);
    toast('Ссылка скопирована', 'success');
  } catch {
    input.select();
    toast('Скопируйте ссылку вручную (Ctrl+C)', '');
  }
});
document.getElementById('btn-kp-print').addEventListener('click', () => window.print());
document.getElementById('btn-kp-new').addEventListener('click', () => {
  if (state.proposal.items.length || state.proposal.title) {
    if (!confirm('Начать новый расчёт? Несохранённые изменения текущего ТЗ будут потеряны.')) return;
  }
  state.proposal = emptyProposal();
  fillFieldsFromProposal();
  renderLines();
  renderFiles();
  renderSheetMeta();
});

async function openProposal(id) {
  const p = await api.get(`/api/proposals/${id}`);
  state.proposal = { ...p, items: p.items.map((it) => ({ ...it, _localId: it.serviceId + Math.random() })) };
  fillFieldsFromProposal();
  renderLines();
  renderFiles();
  renderSheetMeta();
  switchView('builder');
}

// -------------------------------------------------------- сохранённые ТЗ ---
async function renderProposalsList() {
  const body = document.getElementById('proposals-table-body');
  const empty = document.getElementById('proposals-empty');
  const list = await api.get('/api/proposals');
  state.proposals = list;
  empty.hidden = list.length > 0;
  body.innerHTML = list.map((p) => `
    <tr>
      <td><strong>${escapeHtml(p.number)}</strong><span class="sub" style="display:block;color:var(--ink-faint);font-size:11.5px;">${fmtDate(p.createdAt)}</span></td>
      <td class="name-cell">${escapeHtml(p.title || p.objectAddress || '—')}${p.clientName ? `<span class="sub">${escapeHtml(p.clientName)}</span>` : ''}</td>
      <td class="muted-cell">${escapeHtml(p.installerName || '—')}</td>
      <td class="num"><strong>${fmtMoney(p.totalAmount, symbol())}</strong></td>
      <td><span class="status-pill ${p.status}">${p.status === 'sent' ? 'Отправлено' : 'Черновик'}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-icon btn-ghost" data-open-proposal="${p.id}" title="Открыть">${icon('edit')}</button>
          <button class="btn btn-icon btn-ghost" data-link-proposal="${p.id}" title="Ссылка для монтажника">${icon('link')}</button>
          <button class="btn btn-icon btn-ghost" data-dup-proposal="${p.id}" title="Дублировать">${icon('copy')}</button>
          <button class="btn btn-icon btn-ghost" data-del-proposal="${p.id}" title="Удалить">${icon('trash')}</button>
        </div>
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-open-proposal]').forEach((b) => b.addEventListener('click', () => openProposal(b.dataset.openProposal)));
  body.querySelectorAll('[data-dup-proposal]').forEach((b) => b.addEventListener('click', async () => {
    await api.post(`/api/proposals/${b.dataset.dupProposal}/duplicate`);
    renderProposalsList();
    toast('ТЗ продублировано', 'success');
  }));
  body.querySelectorAll('[data-del-proposal]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Удалить это ТЗ?')) return;
    await api.del(`/api/proposals/${b.dataset.delProposal}`);
    renderProposalsList();
    toast('ТЗ удалено');
  }));
  body.querySelectorAll('[data-link-proposal]').forEach((b) => b.addEventListener('click', () => {
    const p = list.find((x) => x.id === b.dataset.linkProposal);
    if (!p) return;
    document.getElementById('share-link-input').value = `${location.origin}/p.html?token=${p.shareToken}`;
    openModal('share-modal');
  }));
}

// ------------------------------------------------------------------ init ---
async function init() {
  try {
    await loadShared();
    fillFieldsFromProposal();
    renderLines();
    renderFiles();
    renderSheetMeta();
    switchView('builder');
  } catch (err) {
    console.error(err);
    toast('Не удалось загрузить данные: ' + err.message, 'error');
  }
}
init();
