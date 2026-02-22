# Cooking Receipts

Персональный сайт рецептов на `React + TypeScript` и `Node.js + Express + PostgreSQL`.

## Что реализовано

- CRUD рецептов: создание, редактирование, удаление.
- Поля рецепта: название, описание, порции, время подготовки/готовки, фото.
- Ингредиенты с количеством и единицами (`г`, `мл`, `шт`).
- Шаги приготовления с порядком.
- Теги рецептов.
- Поиск по названию и фильтр по тегу.
- Загрузка фото и хранение файлов в `backend/uploads`.

## Структура проекта

- `frontend` — Vite + React + TypeScript.
- `backend` — Express + TypeScript + PostgreSQL.
- `docker-compose.yml` — запуск всего стека для локального окружения или VPS.

## Требования

- Node.js 20+
- npm 10+
- Docker + Docker Compose (для контейнерного запуска)

## Запуск локально (без Docker)

1. Создай `.env` из шаблона:
   - скопируй `.env.example` в `.env`
   - для локального PostgreSQL замени хост в `DATABASE_URL` на `localhost`
2. Установи зависимости:
   - `npm install`
3. Примени схему БД:
   - `npm run migrate`
4. Запусти backend:
   - `npm run dev:backend`
5. Запусти frontend:
   - `npm run dev:frontend`
6. Открой `http://localhost:5173`.

## Запуск через Docker Compose

1. Скопируй `.env.example` в `.env` (можно оставить значения по умолчанию).
2. Подними сервисы:
   - `docker compose up --build`
3. Приложение будет доступно:
   - frontend: `http://localhost:5173`
   - backend health: `http://localhost:4000/health`

При старте контейнера backend миграция выполняется автоматически (`npm run migrate`).

## Полезные команды

- `npm run build` — сборка backend и frontend.
- `npm run migrate` — применить схему БД.
- `npm run dev:backend` — backend в watch-режиме.
- `npm run dev:frontend` — frontend в watch-режиме.
