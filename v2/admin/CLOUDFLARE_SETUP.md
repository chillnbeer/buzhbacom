# Настройка Cloudflare D1 для buzhba.com/v2

Эта версия рассчитана на Cloudflare Pages, который тянет код из GitHub.
GitHub остается источником файлов, Cloudflare отдает сайт и запускает API из папки `functions/`.

## 1. Создать D1 базу

1. Открой Cloudflare Dashboard.
2. Слева открой `Workers & Pages`.
3. Открой `D1 SQL Database`.
4. Нажми `Create database`.
5. Название: `buzhba-forum`.
6. Нажми `Create`.

## 2. Создать таблицы

1. Открой базу `buzhba-forum`.
2. Открой вкладку `Console`.
3. Вставь SQL из файла `migrations/0001_forum_cms.sql`.
4. Нажми `Execute`.

## 3. Привязать D1 к Pages-проекту

1. В Cloudflare Dashboard открой `Workers & Pages`.
2. Открой Pages-проект, который обслуживает `buzhba.com`.
3. Открой `Settings`.
4. Открой `Bindings`.
5. Нажми `Add binding`.
6. Выбери `D1 database`.
7. `Variable name`: `DB`.
8. `D1 database`: `buzhba-forum`.
9. Нажми `Save`.

## 4. Добавить админ-токен

1. В том же Pages-проекте открой `Settings`.
2. Открой `Environment variables`.
3. Нажми `Add variable`.
4. Name: `ADMIN_TOKEN`.
5. Value: придумай длинную строку-пароль.
6. Сохрани для `Production`. Если есть `Preview`, можно добавить туда тоже.

## 5. Передеплоить сайт

1. В Pages-проекте открой `Deployments`.
2. Нажми `Retry deployment` или `Redeploy` на последнем production deploy.
3. Дождись статуса `Success`.

## 6. Проверить API

Открой:

`https://buzhba.com/api/forum/health`

Нормальный ответ:

```json
{
  "ok": true,
  "db": "bound"
}
```

Потом открой:

`https://buzhba.com/api/forum/state`

Там должен быть JSON со структурой форума.

## 7. Подключить админку

1. Открой `https://buzhba.com/v2/admin/`.
2. Пролистай до блока `Cloudflare D1 / Экспорт`.
3. Вставь `ADMIN_TOKEN`.
4. Нажми `Сохранить токен`.
5. Нажми `Загрузить из D1`.
6. Внеси изменение.
7. Нажми `Опубликовать в D1`.

Если токен сохранен, админка также пробует автосохранять изменения в D1 после правок.
