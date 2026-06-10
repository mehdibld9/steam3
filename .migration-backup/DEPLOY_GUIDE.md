# SteamShare — Deployment & Supabase Guide

---

## Part 1 — Switch to Supabase

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Pick a name, region closest to your users, and a strong database password
3. Wait ~2 minutes for provisioning

### Step 2: Get the Connection String

1. In your Supabase dashboard → **Project Settings** → **Database**
2. Scroll to **Connection string** → pick the **URI** tab
3. Choose **Transaction pooler** (port 6543) — this is optimised for web apps
4. Copy the URL — it looks like:
   ```
   postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual DB password

### Step 3: Run the Schema SQL

1. In Supabase → **SQL Editor** → **New query**
2. Paste the entire SQL block below and click **Run**

```sql
-- Session store
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "username" text NOT NULL UNIQUE,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "avatar_url" text,
  "points" integer NOT NULL DEFAULT 100,
  "xp" integer NOT NULL DEFAULT 0,
  "level" integer NOT NULL DEFAULT 1,
  "badge_name" text,
  "is_admin" boolean NOT NULL DEFAULT false,
  "is_moderator" boolean NOT NULL DEFAULT false,
  "is_banned" boolean NOT NULL DEFAULT false,
  "ban_reason" text,
  "ban_expires_at" timestamptz,
  "registration_ip" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Accounts
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "games" text[] NOT NULL DEFAULT '{}',
  "points_cost" integer NOT NULL DEFAULT 0,
  "steam_username" text NOT NULL,
  "steam_password" text NOT NULL,
  "is_available" boolean NOT NULL DEFAULT true,
  "likes_count" integer NOT NULL DEFAULT 0,
  "claims_count" integer NOT NULL DEFAULT 0,
  "working_votes" integer NOT NULL DEFAULT 0,
  "not_working_votes" integer NOT NULL DEFAULT 0,
  "view_count" integer NOT NULL DEFAULT 0,
  "unlock_method" text NOT NULL DEFAULT 'login',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "likes_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Likes
CREATE TABLE IF NOT EXISTS "likes" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Ad links
CREATE TABLE IF NOT EXISTS "ad_links" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "description" text,
  "points_reward" integer NOT NULL DEFAULT 50,
  "max_uses" integer NOT NULL DEFAULT 1,
  "uses_count" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Ad link redemptions
CREATE TABLE IF NOT EXISTS "ad_link_redemptions" (
  "id" serial PRIMARY KEY,
  "ad_link_id" integer NOT NULL REFERENCES "ad_links"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Badges
CREATE TABLE IF NOT EXISTS "badges" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "description" text NOT NULL,
  "xp_threshold" integer NOT NULL,
  "icon_url" text
);

-- Giveaways
CREATE TABLE IF NOT EXISTS "giveaways" (
  "id" serial PRIMARY KEY,
  "created_by" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "prize" text NOT NULL,
  "task_description" text NOT NULL,
  "task_link" text,
  "task_code" text,
  "max_entries" integer NOT NULL DEFAULT 100,
  "entries_count" integer NOT NULL DEFAULT 0,
  "end_date" timestamptz NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "winner_user_id" integer,
  "winner_username" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Giveaway entries
CREATE TABLE IF NOT EXISTS "giveaway_entries" (
  "id" serial PRIMARY KEY,
  "giveaway_id" integer NOT NULL REFERENCES "giveaways"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_proof" text,
  "ip_address" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS "reports" (
  "id" serial PRIMARY KEY,
  "reporter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" integer NOT NULL,
  "reason" text NOT NULL,
  "details" text,
  "is_dismissed" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY,
  "sender_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "receiver_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Account votes
CREATE TABLE IF NOT EXISTS "account_votes" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "vote" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
```

### Step 4: Update Environment Variables

When deploying (Vercel), set these environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Supabase Transaction Pooler URI (port 6543) |
| `SESSION_SECRET` | A long random string (32+ chars) — generate with `openssl rand -hex 32` |
| `NODE_ENV` | `production` |

> **Important:** Supabase Transaction Pooler doesn't support prepared statements. Add `?pgbouncer=true&connection_limit=1` to your DATABASE_URL if you see errors about prepared statements.

---

## Part 2 — Deploy to Vercel

### Architecture on Vercel

| Part | How it deploys |
|---|---|
| Frontend (`artifacts/steamshare`) | Vercel Static Site (Vite build → CDN) |
| API (`artifacts/api-server`) | Vercel Serverless Function (Node.js) |

---

### Step 1: Push to GitHub

Vercel deploys from Git. Push your Replit project to GitHub:

1. In Replit, open the **Git** panel (left sidebar)
2. Connect to GitHub and push to a new repo (e.g. `steamshare`)

Or from terminal:
```bash
git remote add origin https://github.com/YOUR_USERNAME/steamshare.git
git push -u origin main
```

---

### Step 2: Create the Vercel API Adapter

Vercel needs the Express app exported as a module. Create this file:

**`artifacts/api-server/api/index.ts`**
```typescript
import app from "../src/app";
export default app;
```

---

### Step 3: Add `vercel.json` at the repo root

```json
{
  "version": 2,
  "buildCommand": "pnpm install && pnpm --filter @workspace/steamshare run build",
  "outputDirectory": "artifacts/steamshare/dist",
  "functions": {
    "artifacts/api-server/api/index.ts": {
      "runtime": "@vercel/node@3"
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/artifacts/api-server/api/index.ts"
    },
    {
      "source": "/((?!api).*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### Step 4: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Vercel will auto-detect the `vercel.json`
4. **Before deploying**, go to **Environment Variables** and add:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Supabase Transaction Pooler connection string |
| `SESSION_SECRET` | Your random secret (32+ chars) |
| `NODE_ENV` | `production` |

5. Click **Deploy**

---

### Step 5: Update CORS (after deploy)

Once deployed, you'll get a URL like `https://steamshare.vercel.app`. Update the CORS config in `artifacts/api-server/src/app.ts`:

```typescript
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? "https://YOUR-SITE.vercel.app"  // replace with your actual URL
      : true,
    credentials: true,
  }),
);
```

And update the cookie config for cross-origin sessions:
```typescript
cookie: {
  secure: true,
  sameSite: "none",   // required for cross-origin cookies
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
```

---

### Step 6: Set Your First Admin

After registering your account on the live site, run this in Supabase SQL Editor:

```sql
UPDATE users SET is_admin = true WHERE username = 'YOUR_USERNAME';
```

---

## Quick Checklist

- [ ] Supabase project created
- [ ] SQL schema run in Supabase SQL Editor
- [ ] Supabase connection string copied (Transaction Pooler, port 6543)
- [ ] `SESSION_SECRET` generated (`openssl rand -hex 32`)
- [ ] Code pushed to GitHub
- [ ] `artifacts/api-server/api/index.ts` adapter file created
- [ ] `vercel.json` added to repo root
- [ ] Vercel project created, env vars set
- [ ] Deployed successfully
- [ ] Admin account promoted via SQL
