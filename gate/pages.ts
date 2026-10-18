// Страницы пароля. Свой код и стили внутри, ни одного внешнего файла: до входа с сайта нельзя взять ничего.
// Оформление в духе «Сигнала»: тёмный холст, лаймовый акцент, подписи моноширинным.

const CSS = `
*{box-sizing:border-box}
html{background:#080909;color-scheme:dark}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#080909;color:#F1F0EA;font:16px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:340px}
.mark{display:flex;align-items:center;gap:10px;margin:0;font-size:24px;font-weight:600;letter-spacing:-.01em}
.mark i{display:block;width:12px;height:12px;background:#D4FF3A}
.cap,label{display:block;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#969A96}
.cap{margin:8px 0 32px}
label{margin-bottom:8px}
input[type=password]{width:100%;height:48px;padding:0 14px;background:transparent;border:1px solid #666B67;border-radius:0;color:#F1F0EA;font:inherit;font-size:16px;outline:none}
input[type=password]:focus{border-color:#D4FF3A;box-shadow:0 0 0 1px #D4FF3A}
button{width:100%;height:48px;margin-top:12px;border:0;border-radius:0;background:#D4FF3A;color:#0B0D00;font:600 14px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
.err{min-height:20px;margin:10px 0 0;font-size:14px;color:#FF5A4A}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
p.note{margin:0;font-size:15px;color:#C5C7C1}
code{font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#D4FF3A}
`.trim();

// Пароль едет заголовком Authorization (Basic): промежуточный слой Vercel не получает тело запроса, а заголовки получает.
// После верного пароля страница обновляется на том же адресе, поэтому ссылка из письма Supabase (с #токеном в конце) не теряется.
function script(loginPath: string): string {
  return `
(function () {
  var form = document.querySelector('form');
  var field = document.getElementById('password');
  var err = document.getElementById('err');
  var btn = form.querySelector('button');
  function basic(password) {
    var bytes = new TextEncoder().encode('ikigai:' + password), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'Basic ' + btoa(bin);
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    fetch('${loginPath}', { method: 'POST', credentials: 'same-origin', headers: { authorization: basic(field.value) } })
      .then(function (r) {
        if (r.ok) { location.reload(); return; }
        err.textContent = r.status === 401 ? 'Неверный пароль' : 'Не получилось (' + r.status + '). Попробуй ещё раз';
        btn.disabled = false;
        field.select();
      })
      .catch(function () {
        err.textContent = 'Нет связи. Попробуй ещё раз';
        btn.disabled = false;
      });
  });
})();
`.trim();
}

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23080909'/%3E%3Crect x='9' y='9' width='14' height='14' fill='%23D4FF3A'/%3E%3C/svg%3E";

/** Политика для этих страниц: свои стили и скрипт, связь только с этим же сайтом. */
export const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";

function shell(body: string, extra = ''): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#080909">
<title>Ikigai</title>
<link rel="icon" href="${FAVICON}">
<style>${CSS}</style>
</head>
<body>
<main>
<p class="mark"><i></i>Ikigai</p>
<p class="cap">Закрытый сайт</p>
${body}
</main>
${extra}
</body>
</html>`;
}

/** Окно с паролем. Отправляет его скрипт страницы на `loginPath`; без скрипта войти нельзя, об этом сказано в странице. */
export function loginPage(loginPath: string): string {
  return shell(
    `<form autocomplete="on">
<input class="sr" type="text" name="username" value="ikigai" autocomplete="username" tabindex="-1" aria-hidden="true">
<label for="password">Пароль</label>
<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
<p class="err" id="err" role="alert"></p>
<button type="submit">Войти</button>
</form>
<noscript><p class="err">Для входа нужен включённый JavaScript.</p></noscript>`,
    `<script>${script(loginPath)}</script>`,
  );
}

/** Пароль на сайт ещё не задан: сайт никому не открывается, пока его не зададут. */
export function notConfiguredPage(): string {
  return shell(
    `<p class="note">Пароль для входа ещё не задан, поэтому сайт закрыт для всех.</p>
<p class="note" style="margin-top:16px">В терминале, в папке проекта: <code>bash scripts/site-password.sh</code>, потом выложи сайт заново.</p>`,
  );
}
