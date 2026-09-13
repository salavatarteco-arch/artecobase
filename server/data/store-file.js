// Простое файловое хранилище на JSON с атомарной записью.
// Достаточно для одного локального пользователя/офиса — не требует
// нативных зависимостей (SQLite и т.п.), которые сложно собрать на Windows
// без Build Tools.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readJson(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[store] Не удалось прочитать ${name}.json:`, err.message);
    // Бэкапим повреждённый файл, чтобы не потерять данные и не упасть.
    const backupPath = filePath(`${name}.corrupted.${Date.now()}`);
    try { fs.copyFileSync(p, backupPath); } catch (_) {}
    return fallback;
  }
}

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* ignore */ }
}

function writeJson(name, data) {
  const p = filePath(name);
  const tmp = `${p}.tmp`;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, json, 'utf8');

  // На Windows переименование файла иногда упирается в EPERM/EBUSY из-за
  // антивируса/индексатора, кратковременно держащих хендл — повторяем попытку.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      fs.renameSync(tmp, p);
      return;
    } catch (err) {
      const transient = err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES';
      if (!transient || attempt === MAX_ATTEMPTS) {
        // Последний шанс: прямая перезапись без rename (теряем атомарность, но не падаем).
        try {
          fs.writeFileSync(p, json, 'utf8');
          try { fs.unlinkSync(tmp); } catch { /* ignore */ }
          return;
        } catch (writeErr) {
          throw writeErr;
        }
      }
      sleepSync(30 * attempt);
    }
  }
}

class Collection {
  constructor(name, fallback = []) {
    this.name = name;
    this._cache = readJson(name, fallback);
  }

  all() {
    return this._cache;
  }

  save() {
    writeJson(this.name, this._cache);
  }

  set(data) {
    this._cache = data;
    this.save();
  }
}

module.exports = { Collection, DATA_DIR };
