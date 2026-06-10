---
name: SteamShare dev setup
description: How the artifact-based dev environment is configured on Replit for SteamShare.
---

# SteamShare Dev Environment

## Workflow setup (artifact-managed — do NOT add duplicate named workflows)
- **artifacts/api-server: API Server** — runs `pnpm --filter @workspace/api-server run dev`, listens on port 8080. PORT=8080 is baked into the dev script in `artifacts/api-server/package.json`.
- **artifacts/steamshare: web** — runs `pnpm --filter @workspace/steamshare run dev`, Vite reads PORT from Replit's dynamically assigned port (e.g. 19720). Proxies `/api` to `http://localhost:8080`.
- **artifacts/mockup-sandbox: Component Preview Server** — canvas preview server.

## Critical port rule
Do NOT set PORT, VITE_PORT, or API_PORT as shared env vars. Replit dynamically assigns PORT for each artifact workflow. Shared PORT overrides Replit's assignment and breaks the steamshare web artifact. The API server has PORT=8080 baked into its own dev script instead.

## Environment variables
- No PORT in shared env — Replit assigns it dynamically per artifact
- `DATABASE_URL`, `SESSION_SECRET` — Replit secrets (already provisioned)

## Why
Replit artifact workflows receive PORT dynamically. If PORT is a shared env var, it overrides the dynamic assignment and steamshare Vite binds to the wrong port (e.g. 8080 instead of the artifact's assigned port), causing the workflow to fail with "didn't open expected port".

## Database
Schema pushed via `pnpm --filter @workspace/db run push` using Replit's built-in PostgreSQL.

## Auth
Session-based auth using express-session + connect-pg-simple + bcrypt. No external auth provider.
