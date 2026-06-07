# SteamShare

SteamShare is a Steam account marketplace where users share unused Steam libraries, claim games with points, and rise through ranks with XP and badges.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/steamshare run dev` — run the frontend (port set by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — session signing secret (defaults to dev secret if not set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + shadcn/ui + wouter routing
- API: Express 5 with session-based auth
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/steamshare/src/` — React frontend
  - `pages/` — all route pages (home, browse, account-detail, profile, leaderboard, etc.)
  - `components/` — layout, account-card, and shadcn UI components
  - `src/App.tsx` — wouter router with all routes
  - `src/index.css` — Tailwind + CSS variables (theme)
- `artifacts/api-server/src/` — Express backend
  - `routes/` — all API route handlers
  - `lib/` — logger, steam checker
  - `middlewares/` — auth middleware
- `lib/db/src/schema/` — Drizzle ORM schema (users, accounts, comments, likes, badges, giveaways, etc.)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas

## Architecture decisions

- Session-based auth (express-session + connect-pg-simple) rather than JWT; sessions stored in Postgres.
- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks for all endpoints.
- Frontend is fully client-rendered (Vite SPA); Express serves both the API and the built static files in production.
- Points system: users earn points by visiting ad links, can spend them to claim Steam accounts.
- XP/badge system tracks user activity and ranks them on a leaderboard.

## Product

- Browse and search Steam account listings by game
- Register/login, earn points by visiting ad links, spend points to claim accounts
- Submit your own Steam account listings (with credential verification)
- User profiles with XP, levels, and badges
- Leaderboard ranking users by XP
- Giveaways system for admins
- Admin panel for managing users, listings, and ad links
- Messaging between users
- Password reset via token

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/db run push` after any schema change in `lib/db/src/schema/`.
- Re-run `pnpm --filter @workspace/api-spec run codegen` after any change to `lib/api-spec/openapi.yaml`.
- SESSION_SECRET env var is needed in production — set it as a secret.
- The frontend uses `fetch('/api/...')` with `credentials: 'include'` for session cookies.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
