import { isAdminRequest } from "./_auth.js";

function loginPage(url) {
  const failed = url.searchParams.get("error") === "1";
  return new Response(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Вход - группа бужба</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#333;font:13px/1.35 Arial,Helvetica,sans-serif}
    .page{width:min(620px,calc(100% - 32px));margin:80px auto}
    .title{height:92px;display:flex;align-items:center;padding:0 24px;border:1px solid #bdc7d0;background:#dfe4e8;font-size:22px}
    .bar{padding:7px 18px 8px;border:1px solid #9fb0c0;border-top:0;background:linear-gradient(#7fa3ca,#5e88b8 50%,#547dad);color:#fff;font-weight:bold}
    form{padding:24px;border:1px solid #bdc7d0;border-top:0;box-shadow:0 4px 0 #e5e5e5}
    label{display:block;margin-bottom:8px;font-weight:bold}
    input{width:100%;min-height:38px;padding:8px;border:1px solid #9fb0c0;font:inherit}
    button{margin-top:16px;min-height:36px;padding:7px 14px;border:1px solid #6c829b;background:linear-gradient(#7fa3ca,#547dad);color:#fff;font:bold 13px Arial;text-shadow:0 1px rgba(0,0,0,.18);cursor:pointer}
    .err{margin:0 0 14px;padding:10px 12px;border:1px solid #e2b0b0;background:#fff0f0;color:#8b1d1d}
    a{color:#0058a9}
  </style>
</head>
<body>
  <main class="page">
    <div class="title">группа бужба</div>
    <div class="bar">Вход администратора</div>
    <form method="post" action="/api/forum/login">
      ${failed ? '<p class="err">Неверный логин или пароль</p>' : ''}
      <label for="login">Логин</label>
      <input id="login" name="login" type="text" autocomplete="username" autofocus>
      <label for="password">Пароль</label>
      <input id="password" name="password" type="password" autocomplete="current-password">
      <details>
        <summary>Войти старым ADMIN_TOKEN</summary>
        <label for="token">ADMIN_TOKEN</label>
        <input id="token" name="token" type="password" autocomplete="off">
      </details>
      <button type="submit">Войти</button>
      <p><a href="/v2/">вернуться на форум</a></p>
    </form>
  </main>
</body>
</html>`, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isAdminRoute(pathname) {
  return pathname === "/v2/admin" || pathname.startsWith("/v2/admin/");
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!isAdminRoute(url.pathname)) return context.next();

  if (await isAdminRequest(context.request, context.env)) {
    return context.next();
  }

  return loginPage(url);
}
