// Устойчивый fetch для парсеров.
//
// На некоторых компьютерах (антивирус/корпоративный прокси с перехватом HTTPS)
// Node не может проверить сертификат сайта-поставщика, даже если сам сервер
// запущен с флагом --use-system-ca (пользователь мог запустить его иначе —
// напрямую из IDE, ярлыком, старым способом и т.п.). Раньше это выглядело
// как "парсинг не работает" без понятной причины.
//
// Здесь мы сначала пробуем обычный fetch, и только если он падает именно
// из-за сертификата — повторяем запрос через агент, который не проверяет
// цепочку сертификатов. Это безопасно в контексте задачи: мы просто читаем
// публичную страницу каталога поставщика, не передаём и не получаем никаких
// приватных данных пользователя.

const { Agent } = require('undici');

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

function isCertificateError(err) {
  const msg = String((err && err.cause && err.cause.message) || (err && err.message) || '');
  const code = (err && err.cause && err.cause.code) || (err && err.code) || '';
  return /certificate|self.signed|unable to verify/i.test(msg) ||
    /CERT_|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code);
}

async function robustFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (isCertificateError(err)) {
      return await fetch(url, { ...options, dispatcher: insecureAgent });
    }
    throw err;
  }
}

module.exports = { robustFetch, isCertificateError };
