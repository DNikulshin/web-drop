# Session Context

## Repository
- Name: web-drop
- Owner: DNikulshin
- Current branch: main
- Workspace root: /workspaces/web-drop

## Current scope
- API is the main active workstream
- Web app is a thin Next.js shell for future UI integration
- Focus is on making the backend reliable, documented and covered by tests

## Current status
- Sessions and WebSocket sync are implemented
- File upload/download support exists for base64 and multipart payloads
- Local and S3-backed storage paths are supported
- TTL cleanup and metrics are wired in
- Build and tests are passing for the API package

## Recent work completed
- Added API routes for sessions and health checks
- Added files routes with storage abstraction
- Added S3 support and cleanup worker
- Added QR endpoint and metrics exposure
- Added unit and e2e tests for files and sessions

## Key areas for next iteration
- Finish the web UI integration for sessions and files
- Add richer multipart and UI-driven E2E coverage
- Harden CI/CD and deployment config

## Useful commands
```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Notes
- API docs are available at /docs
- Web app runs at http://localhost:3000
- API runs at http://localhost:3001
