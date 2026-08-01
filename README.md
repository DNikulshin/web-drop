# Web Drop

Web Drop is a developer-focused project built as a monorepo with a typed Fastify API and a Next.js frontend.
The main idea is to provide a clean, documented backend service for creating and checking lightweight sessions, with Swagger/OpenAPI docs available immediately for testing and integration.

## What it is
- A Fastify v5 API under `apps/api`.
- A Next.js 16 frontend under `apps/web`.
- Full OpenAPI/Swagger documentation for API endpoints.
- Type-safe route definitions and schema validation using Zod and Prisma.

## Why it exists
- To deliver a production-ready backend service with strong developer ergonomics.
- To make API documentation usable from day one via `/docs`.
- To support fast local development in Codespaces.

## Current status
- `apps/api` has Swagger UI and JSON schema documentation.
- Type-safe Swagger registration was implemented with custom type augmentation.
- Basic health and session endpoints are documented and available.
- A session context file (`SESSION_CONTEXT.md`) is included for smooth handover between development sessions.

## Tech stack
- `pnpm` monorepo with Turborepo
- `apps/api`: Fastify v5, `@fastify/swagger`, `@fastify/swagger-ui`, Zod, Prisma, Redis
- `apps/web`: Next.js 16, React 19

## Getting started
1. Install dependencies: `pnpm install`
2. Start the API: `pnpm --filter @web-drop/api dev`
3. Open Swagger UI on the API server at `/docs`

## Next session goals
- Verify Swagger UI "Try it out" behavior
- Expand OpenAPI schemas for more API routes
- Add automated API smoke tests
- Review `apps/web` integration with the documented API
