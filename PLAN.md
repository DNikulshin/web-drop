# Plan

## Текущее состояние проекта
Web Drop уже реализован как рабочий monorepo с API, web-частью, Redis/Prisma интеграцией и базовой файловой логикой.

## Что уже сделано
- Fastify API с маршрутом health, сессиями и WebSocket
- Файлообмен через base64 и multipart
- Поддержка S3/локального хранилища, TTL и очистка по истечении времени
- Метрики и background cleanup worker
- QR endpoint и базовые e2e/unit тесты

## Приоритеты на следующий этап
1. Довести web UI до рабочего состояния для сессий и файлов
2. Добавить более полный E2E для multipart и UI-сценариев
3. Подготовить production-конфиг и CI
4. При необходимости добавить Docker/compose и наблюдаемость

## Рекомендуемые команды
```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Ожидаемые URL
- Web: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs
