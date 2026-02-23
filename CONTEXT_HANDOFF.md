# CONTEXT HANDOFF

Этот файл нужен для быстрого переключения в новый чат/контекст без потери состояния.

## Проект

- Название: `cooking-receipts`
- Стек:
  - Frontend: `React + TypeScript + Vite`
  - Backend: `Node.js + Express + TypeScript`
  - DB: `PostgreSQL`
  - Деплой локально/VPS: `Docker Compose`

## Что уже реализовано

- CRUD рецептов:
  - создание, редактирование, удаление, просмотр, список.
- Поиск/фильтры:
  - по названию, по тегу, по категории.
- Категории:
  - обязательны для каждого рецепта.
- Ингредиенты:
  - с единицами (`г`, `мл`, `шт`, `столовая ложка`, `чайная ложка`).
  - разделение по блокам (например `Основное`, `Соус`, `Гарнир`).
  - количество хранится как текст (можно `100-150`, `1/2`, `по вкусу`).
- Шаги приготовления:
  - упорядоченный список.
- Фото:
  - загрузка и хранение в `backend/uploads`.
- UI:
  - заголовок `Мои рецепты` кликабельный, возвращает на главную.

## Важные последние изменения

- Добавлена обязательная `category` для рецептов.
- Добавлен `section` для ингредиентов (группировка по блокам).
- Поле `amount` ингредиента переведено в текстовый тип:
  - БД: `recipe_ingredients.amount` -> `TEXT`
  - API валидация больше не требует число.
  - Frontend: поле количества теперь текстовое.

## База данных / миграции

- Схема в: `backend/src/schema.sql`
- Миграция запускается:
  - вручную: `npm run migrate`
  - в контейнере backend при старте (команда `npm run migrate && npm run start`)

## Запуск

1. Убедиться, что есть `.env` (можно из `.env.example`).
2. Запуск:
   - `docker compose up --build`
3. Адреса:
   - Frontend: `http://localhost:5173`
   - Backend health: `http://localhost:4000/health`

Если после изменений не видно новую версию:
- `Ctrl + F5` в браузере.

## Технические заметки

- На Windows иногда был временный сбой Docker Hub (`unexpected EOF` при auth token).
- В таком случае помогало:
  - повторить команду, или
  - собрать через legacy builder:
    - `set DOCKER_BUILDKIT=0` (cmd) / `$env:DOCKER_BUILDKIT=0` (PowerShell)
    - затем `docker compose build`

## Полезные команды

- Сборка локально:
  - `npm run build -w backend`
  - `npm run build -w frontend`
- Полный цикл Docker:
  - `docker compose down`
  - `docker compose build`
  - `docker compose up`

## Где смотреть код ключевых частей

- Backend API: `backend/src/index.ts`
- DB schema: `backend/src/schema.sql`
- Frontend UI: `frontend/src/App.tsx`
- Frontend API client: `frontend/src/api.ts`
- Типы фронта: `frontend/src/types.ts`

