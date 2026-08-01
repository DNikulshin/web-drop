# Web Drop

Web Drop — монорепозиторий для быстрой синхронизации текста и обмена файлами между устройствами без регистрации.

## Что реализовано
- API на Fastify с маршрутами сессий и WebSocket-синхронизацией
- Загрузка и скачивание файлов через base64 и multipart
- Поддержка S3-совместимого хранилища с TTL/автоочисткой
- Метрики и health-checks
- Swagger/OpenAPI и набор тестов для API

## Архитектура
- API: apps/api
- Web: apps/web
- Shared contracts: packages/contracts
- Prisma client and DB layer: packages/db

## Технологии
- Fastify v5, @fastify/swagger, @fastify/swagger-ui
- WebSocket для синхронизации сессий
- Redis для metadata/session events
- Prisma + PostgreSQL
- Next.js 16 + React 19 для web-части

## Быстрый старт
1. Установите зависимости:
   ```bash
   pnpm install
   ```
2. Запустите API:
   ```bash
   pnpm --filter @web-drop/api dev
   ```
3. Запустите web:
   ```bash
   pnpm --filter web dev
   ```
4. Откройте:
   - API docs: http://localhost:3001/docs
   - Web: http://localhost:3000

## Полезные команды
```bash
pnpm build
pnpm test
pnpm lint
```

## Текущий статус
- Сессии и WebSocket уже работают
- Файлы можно загружать и скачивать
- Подключена поддержка S3 и очистки по TTL
- Добавлены unit/e2e тесты для API

## Следующие шаги
- Доработать UI в apps/web под новые API-фичи
- Добавить более полный E2E для мультимедийных сценариев
- Подкрутить CI/CD и production-конфиг
