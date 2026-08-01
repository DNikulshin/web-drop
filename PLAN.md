WebDrop — production-ready план и идея проекта

📌 О проекте
WebDrop — сервис быстрого обмена текстом и файлами между устройствами без регистрации. 
Основная цель: максимально простая и безопасная синхронизация текста и обмен файлами через браузер, без установки приложений.

🎯 Продуктовая идея
- Быстрый текстовый обмен между устройствами: создаёшь сессию, подключаешь телефон или второй браузер и синхронизируешь текст в реальном времени.
- Файлообмен по короткой ссылке: загружаешь файл и делишься ссылкой, получатель скачивает без регистрации.
- Принцип «сам с собой» через QR-код + ссылка.
- Безопасность: сервер не хранит содержимое текстов/файлов дольше необходимого.

Ключевые требования
- Без регистрации и паролей
- Мгновенная синхронизация текста через WebSocket
- Гибридный файлообмен: P2P WebRTC + server relay
- TTL и автоматическое удаление данных
- Продуманные health checks и мониторинг
- Чёткое разделение контрактов между фронтом и API

🏗 Архитектура и реализация
Монорепо на Turborepo + pnpm workspaces
Пакеты:
- `apps/api` — backend Fastify + WebSocket + Redis + Prisma
- `apps/web` — frontend Next.js + React + Tailwind
- `packages/db` — общий Prisma client и схема
- `packages/contracts` — общие Zod-контракты для API/Web

Технологии
- Backend: Fastify, `@fastify/websocket`, Redis, Prisma, Zod, NanoID
- Frontend: Next.js 16, React 19, Tailwind CSS, WebSocket
- Shared: TypeScript, workspace пакеты, ESM
- DB: PostgreSQL + Prisma
- Cache/Queue: Redis Streams, Pub/Sub, consumer groups

📦 Пакеты и shared контракты
`packages/contracts`
- Схемы запросов и событий через Zod
- Общие типы для фронта и бэкенда
- Рекомендуется build before app compile

`packages/db`
- Экспорт Prisma client с адаптером `PrismaPg`
- Вспомогательные утилиты для миграций и генерации

`apps/api`
- Роуты: `/api/sessions`, `/api/sessions/:code`, `/ws/session/:code`
- Валидация payload через общие Zod-схемы
- Поддержка WebSocket и Redis-событий

`apps/web`
- Клиентская логика создания сессии и подключения к WebSocket
- Валидация приходящих/уходящих событий через общие схемы
- UI для текста, сессии и событий

🚀 Production-ready требования
1. Надёжность Redis
- Redis Streams + Consumer Groups
- Auto-reclaim и retry для застрявших сообщений
- DLQ для неуспешных событий
- XTRIM по времени для контроля роста логов

2. Отказоустойчивость
- Circuit breaker для Redis
- Graceful fallback на in-memory broadcast при проблемах
- Хранение состояния сессии в Redis + fallback в памяти только как запасной вариант

3. Наблюдаемость и мониторинг
- `/health/live` и `/health/ready`
- Логи через Pino
- Метрики: latency, websocket connections, redis status
- Настройка Sentry/Prometheus на этапе deploy

4. Разделение контрактов
- Все API контракты живут в `packages/contracts`
- Фронтэнд и бэкенд используют одну схему данных
- Избегаем дублирования типов и несоответствий

5. Безопасность и данные
- TTL на сессии и файлы
- Удаление старых данных по таймауту
- Уменьшение времени жизни текстовых сообщений
- Возможность шифрования контента на клиенте в будущих спринтах

6. CI/CD
- Авто-сборка пакетов через Turborepo
- Проверка `pnpm install`, `pnpm exec tsc`, `pnpm exec vitest`
- Развёртывание frontend на Vercel, API на Railway/Render

🛠 Дорожная карта
Спринт 1 — Production-ready Foundation
- Монорепо и workspace с `packages/db` и `packages/contracts`
- Роуты и WebSocket-сессии в `apps/api`
- Реализация `apps/web` с синхронизацией текста
- Валидация контрактов и TypeScript-резкость
- Health checks и базовый отказоустойчивый Redis
- Полная компиляция `tsc --noEmit` для всех пакетов

Спринт 2 — WebRTC & P2P файлообмен
- Signaling через уже существующий WebSocket
- Переход на WebRTC для прямой передачи файлов
- UI загрузки и индикация статуса
- Разработка fallback relay-протокола

Спринт 3 — Server relay + S3 storage
- Хранилище файлов через MinIO / S3
- Chunked upload + presigned URLs
- TTL и очистка истёкших файлов
- Rate limiting и защита от abuse

Спринт 4 — E2E шифрование
- Шифрование на клиенте с Web Crypto
- Хранение ключа в хэше URL
- Безопасный обмен файлами и текстом

Спринт 5 — Polish & PWA
- PWA, оффлайн-функции, доступность
- Визуальные микровзаимодействия и UX
- Превью файлов, адаптивный интерфейс

Спринт 6 — Deploy и мониторинг
- Dockerfile / облачный деплой
- CI/CD, health checks, metrics, alerting
- Домены, SSL, production config

📌 Что сейчас важно
- Завершить `packages/contracts` как единый источник truth для API/Web
- Убедиться, что `apps/api` и `apps/web` компилируются через общий workspace
- Добавить production-ready health checks и отказоустойчивый Redis flow
- Оставить архитектуру простую, но расширяемую на WebRTC и S3

📍 Быстрый старт
1. `pnpm install`
2. `pnpm --filter @web-drop/contracts run build`
3. `pnpm --filter @web-drop/db run build`
4. `pnpm --filter @web-drop/api exec tsc -p tsconfig.json --noEmit`
5. `pnpm --filter web exec tsc -p tsconfig.json --noEmit`

URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

MinIO Console: http://localhost:9001 (логин: minioadmin / minioadmin)
Запуск тестов
bash
12345678910
⚠️ Известные риски и митигации
Риск
Митигация
Redis Pub/Sub не гарантирует доставку
Используем Redis Streams с ACK и consumer groups
In-memory Map не масштабируется
Redis Streams позволяет масштабировать на несколько инстансов
Бесконечные retry при токсичных сообщениях
Dead Letter Queue (DLQ) после 3 retry
Каскадные сбои при недоступности Redis
Circuit Breaker с fallback на in-memory
Утечка памяти в Streams
XTRIM по времени (MINID) — удаляем сообщения старше 1 часа
CORS и WebSocket
Явная настройка CORS в Fastify
Зависимости pnpm
Используем pnpm@9.x и pnpm-workspace.yaml
📊 Метрики и мониторинг (Спринт 6)
Метрики для Prometheus:
Количество активных WebSocket соединений
Количество сообщений в Redis Streams
Latency обработки сообщений
Количество ошибок Circuit Breaker
Размер DLQ
Алерты:
Circuit Breaker в состоянии OPEN > 5 минут
DLQ содержит > 100 сообщений
Latency > 500ms
🎯 Следующие шаги (для AI-агента)
Реализовано: Redis session metadata, TTL refresh, проверка существования сессии и обработка 404.
Реализовать apps/api/src/shared/lib/prisma.ts — импорт из @web-drop/db
Реализовать apps/api/src/shared/lib/redis.ts — Circuit Breaker, Consumer Groups и устойчивое JS Pub/Sub
Реализовать apps/api/src/modules/health/health.routes.ts — health checks
Реализовать apps/api/src/modules/session/session.routes.ts — WebSocket поток и отказоустойчивость
Написать тесты — unit + integration + fault-tolerance
Перейти к Frontend — WebSocket service, UI-компоненты
📞 Контакты и ресурсы
GitHub: https://github.com/DNikulshin
Домен: web-drop.ru
Документация Next.js 16: https://nextjs.org/docs
Документация Fastify: https://www.fastify.io/docs
Документация Redis Streams: https://redis.io/docs/data-types/streams/
Конец документа. AI-агент должен продолжить реализацию с Шага 1 (Backend: prisma.ts, redis.ts, health.routes.ts, session.routes.ts).
После успешной сборки и прохождения тестов делаем подробный коммит и пуш в `main`.

Завершено размышление
Сейчас закоммитим и запушим все изменения в GitHub.
bash
123456789101112131415161718192021222324252627282930
Если gh cli не установлен, выполни эти команды вместо шага 5:
bash
12345
После этого репозиторий будет доступен по адресу: https://github.com/DNikulshin/web-drop
