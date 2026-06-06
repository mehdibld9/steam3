# SteamShare (Account Exchange)

A Steam account marketplace where users share unused Steam libraries, claim accounts using points, and earn XP by participating. Includes a built-in Steam library checker for credential verification.

## Local development

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL

### Setup

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
```

In a second terminal (frontend dev server with hot reload):

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/steamshare run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm run build` | Typecheck and build all packages |
| `pnpm run typecheck` | Typecheck the workspace |
| `pnpm --filter @workspace/api-server run dev` | API on port 8080 (`/api`) |
| `pnpm --filter @workspace/db run push` | Push DB schema to Postgres |

## Deploy to Render

This repo includes a [`render.yaml`](render.yaml) Blueprint for one-click deploy.

1. Push this repo to GitHub (see below).
2. In [Render](https://render.com), click **New → Blueprint** and connect your GitHub repo.
3. Render creates a **Web Service** and **PostgreSQL** database automatically.
4. After the first deploy succeeds, change the default admin password (`admin` / `password123`).

The web service serves both the React frontend and the Express API from a single origin, so sessions work without cross-origin cookie issues.

### Manual Render setup

If you prefer not to use the Blueprint:

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/steamshare run build && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/db run push-force` |
| Start Command | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Health Check | `/api/healthz` |

**Environment variables:**

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes (from Render Postgres) |
| `SESSION_SECRET` | Yes (generate a random string) |
| `NODE_ENV` | `production` |

## Push to GitHub

```bash
git remote remove gitsafe-backup   # remove Replit backup remote if present
git remote add origin https://github.com/YOUR_USERNAME/Account-Exchange.git
git push -u origin main
```

## Stack

- pnpm workspaces, Node.js 24, TypeScript
- API: Express 5 (`/api`)
- Frontend: React + Vite + Tailwind
- DB: PostgreSQL + Drizzle ORM

## Default admin

Username: `admin` — Password: `password123`

**Change this immediately after deploying to production.**
