-- SteamShare — full database schema
-- All statements use IF NOT EXISTS / IF EXISTS so it is safe to re-run.

-- Session store (connect-pg-simple)
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
  "display_name" text,
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

-- Accounts (Steam library listings)
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
  "status" text NOT NULL DEFAULT 'approved',
  "review_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_checked_at" timestamptz,
  "health_fail_count" integer NOT NULL DEFAULT 0
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

-- Likes (accounts and comments)
CREATE TABLE IF NOT EXISTS "likes" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Ad links (earn points by visiting)
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

-- Reports (accounts, users, comments)
CREATE TABLE IF NOT EXISTS "reports" (
  "id" serial PRIMARY KEY,
  "reporter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" integer NOT NULL,
  "reason" text NOT NULL,
  "details" text,
  "is_dismissed" boolean NOT NULL DEFAULT false,
  "is_actioned" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Messages (inbox / system messages)
CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY,
  "sender_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "receiver_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Account votes (working / not working)
CREATE TABLE IF NOT EXISTS "account_votes" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_id" integer NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "vote" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Announcements / news
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "pinned" boolean NOT NULL DEFAULT true,
  "is_popup" boolean NOT NULL DEFAULT false,
  "popup_buttons" text NOT NULL DEFAULT '[]',
  "author_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Store products
CREATE TABLE IF NOT EXISTS "products" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "price" integer NOT NULL,
  "price_usd" text,
  "buy_url" text,
  "stock" integer NOT NULL DEFAULT 0,
  "created_by" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Product reviews
CREATE TABLE IF NOT EXISTS "product_reviews" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Product purchases
CREATE TABLE IF NOT EXISTS "product_purchases" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 1,
  "total_price" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Product delivery units (digital keys / content)
CREATE TABLE IF NOT EXISTS "product_delivery_units" (
  "id" serial PRIMARY KEY,
  "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "is_delivered" boolean NOT NULL DEFAULT false,
  "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Site settings (key-value)
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL DEFAULT '',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Footer links
CREATE TABLE IF NOT EXISTS "footer_links" (
  "id" serial PRIMARY KEY,
  "label" text NOT NULL,
  "url" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
