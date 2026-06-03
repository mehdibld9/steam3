# Steam Family

A Steam account marketplace where users share unused Steam libraries, claim accounts using points, and earn XP by participating. Previously called "SteamShare".

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 at path `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, requires TTY)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, base path `/api`)
- Frontend: React + Vite (base path `/`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — Drizzle table definitions (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for client codegen)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/steamshare/src/pages/` — React page components
- `artifacts/steamshare/src/components/layout.tsx` — Header/nav layout

## Architecture decisions

- DB migrations: `drizzle-kit push` requires a TTY; use `executeSql` in code_execution for CI-style migrations.
- New endpoints for vote, messages, reports, moderator go through direct `fetch()` in the frontend (not codegen hooks) until the OpenAPI spec is updated and codegen is re-run.
- Banned users can log in but are redirected to `/banned` via the `BannedGuard` in `App.tsx` — ban state is checked via `/api/auth/me`.
- Moderators can ban/delete posts but cannot ban other mods/admins and cannot adjust points (admin-only).
- IP dedup for giveaways: first-registered account per IP wins; subsequent accounts from same IP are rejected.
- Working/not-working votes use the `account_votes` table with a unique (user_id, account_id) constraint; clicking the same vote again removes it (toggle).

## Product

- Browse and claim Steam accounts for points
- Submit your own accounts (credentials must be verified first, ~15-20s check)
- Earn XP and level up; earn points from ad links and account claims
- Giveaways with task + optional secret code + IP deduplication
- Direct messaging between users
- Report system with admin/mod dismiss workflow
- Moderator role: can ban users (timed/permanent with reason), delete posts; cannot touch other mods/admins or adjust points
- Admin: full control including points adjustment, moderator promotion, ad link generation

## User preferences

_None recorded yet._

## Gotchas

- `drizzle-kit push` needs TTY — use raw SQL via `executeSql` for schema changes in non-interactive shells.
- Admin credentials: username `admin`, password `password123`.
- The OpenAPI spec (`lib/api-spec/openapi.yaml`) does NOT yet include: vote, messages, reports, moderator endpoints. New frontend code uses direct `fetch()` for these. Run codegen after updating the spec.
- The `BannedGuard` in `App.tsx` uses a direct `useQuery` (not the generated hook) to avoid circular redirect loops.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
