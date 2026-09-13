// Простая защита паролем для облачного деплоя (Vercel и т.п.), где приложение
// доступно из интернета. Активируется только если задан APP_PASSWORD — при
// локальном запуске (.bat, без этой переменной) полностью отключена, вести
// себя как раньше.
//
// Без внешних зависимостей: подписываем cookie через HMAC (crypto из ядра
// Node), без express-session и хранения состояния на сервере.

const crypto = require('crypto');

const COOKIE_NAME = 'arteko_auth';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

function isEnabled() {
  return !!process.env.APP_PASSWORD;
}

function secret() {
  // SESSION_SECRET можно не задавать отдельно — если его нет, подписываем
  // самим паролем (тоже секрет, но известный только серверу и введённым
  // пользователям, этого достаточно для этой задачи).
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD;
}

function sign(value) {
  const h = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  return `${value}.${h}`;
}
function verify(signed) {
  if (!signed || typeof signed !== 'string') return false;
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return false;
  const value = signed.slice(0, idx);
  const expected = sign(value);
  try {
    return crypto.timingSafeEqual(Buffer.from(signed), Buffer.from(expected)) && Date.now() < Number(value);
  } catch {
    return false;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

const LOGIN_PAGE = (error) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Вход — АРТЕКО</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#ECEAE3;--panel:#F8F7F2;--ink:#17140F;--ink-soft:#6E6A61;--line:#E2DED2;--accent:#FF5A22;--danger:#C6432F;}
  *{box-sizing:border-box;}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);font-family:'Manrope',sans-serif;color:var(--ink);}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:32px 30px;width:340px;}
  .brand{display:flex;align-items:center;gap:9px;margin-bottom:20px;}
  .brand svg{width:20px;height:20px;color:var(--accent);}
  .brand b{font-family:'Unbounded',sans-serif;font-size:15px;}
  h1{font-family:'Unbounded',sans-serif;font-size:17px;margin:0 0 6px;}
  p{color:var(--ink-soft);font-size:13px;margin:0 0 18px;}
  input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;font-family:inherit;background:#fff;color:var(--ink);}
  input:focus{outline:none;border-color:var(--accent);}
  button{width:100%;margin-top:12px;padding:11px;border:none;border-radius:9px;background:var(--accent);color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;}
  button:hover{opacity:.92;}
  .err{color:var(--danger);font-size:12.5px;margin-top:10px;}
</style></head>
<body>
  <form class="card" method="post" action="/login">
    <div class="brand"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg><b>АРТЕКО</b></div>
    <h1>Прайс-лист</h1>
    <p>Введите пароль для доступа</p>
    <input type="password" name="password" placeholder="Пароль" autofocus required />
    <button type="submit">Войти</button>
    ${error ? `<div class="err">Неверный пароль</div>` : ''}
  </form>
</body></html>`;

function mount(app) {
  if (!isEnabled()) return; // локальный офлайн-режим — без пароля, как раньше

  app.get('/login', (req, res) => res.send(LOGIN_PAGE(req.query.error)));
  app.post('/login', expressUrlencoded, (req, res) => {
    const password = (req.body && req.body.password) || '';
    if (password === process.env.APP_PASSWORD) {
      const token = sign(String(Date.now() + MAX_AGE_MS));
      res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`);
      return res.redirect('/');
    }
    res.redirect('/login?error=1');
  });

  app.use((req, res, next) => {
    if (req.path === '/login') return next();
    const cookies = parseCookies(req.headers.cookie);
    if (verify(cookies[COOKIE_NAME])) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Требуется вход' });
    return res.redirect('/login');
  });
}

// Мини-парсер без лишних зависимостей — нужен только urlencoded-тело формы
// логина, express.urlencoded() на всё приложение не требуется.
function expressUrlencoded(req, res, next) {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    req.body = Object.fromEntries(new URLSearchParams(data));
    next();
  });
}

module.exports = { mount, isEnabled };
