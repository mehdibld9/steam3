---
name: SteamShare dev setup
description: How the two-workflow dev environment is configured on Replit for SteamShare.
---

# SteamShare Dev Environment

## Workflow setup
- **API Server** workflow: `pnpm --filter @workspace/api-server run dev` — builds with esbuild then runs on port 8080 (console output type).
- **Start application** workflow: `VITE_PORT=5000 pnpm --filter @workspace/steamshare run dev` — Vite SPA on port 5000 (webview output type), proxies `/api` to `http://localhost:8080`.

## Environment variables
- `PORT=8080` — used by the Express API server (index.ts reads this)
- `VITE_PORT=5000` — used by vite.config.ts to bind Vite to port 5000 (avoids collision with PORT)
- `DATABASE_URL`, `SESSION_SECRET` — already provisioned as Replit secrets

## Why
Vite config reads `process.env.PORT` and defaults to 5000. Since `PORT=8080` for the API server, Vite would bind to 8080 and collide. Fix: vite.config.ts now checks `VITE_PORT` first, then `PORT`, then defaults 5000.

## Database
Schema pushed via `pnpm --filter @workspace/db run push` using Replit's built-in PostgreSQL (DATABASE_URL secret).

## Auth
Session-based auth using express-session + connect-pg-simple + bcrypt. No external auth provider — no migration needed.
