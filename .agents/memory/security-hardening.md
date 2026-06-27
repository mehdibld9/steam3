---
name: Security hardening decisions
description: All security patches applied and the reasoning behind each one.
---

## Email domain whitelist
Only @gmail.com, @outlook.com, @hotmail.com, @hotmail.fr, @hotmail.co.uk, @yahoo.com, @yahoo.fr, @yahoo.co.uk, @live.com, @msn.com allowed on registration. Hacker used cadebek.com (disposable). Whitelist is in `ALLOWED_EMAIL_DOMAINS` array in `artifacts/api-server/src/routes/auth.ts`.

**Why:** Disposable/throwaway email providers let attackers create and abandon accounts with no traceability.

## IP tracking
- `last_login_ip` and `last_login_at` added to `usersTable` schema (pushed via drizzle push).
- Login endpoint updates both fields on every successful login.
- Admin `/admin/users` endpoint returns both fields + `email` + `displayName` + `registrationIp`.
- Admin panel users table: click any row to expand — shows email, reg IP, last login IP, last login time, joined date, premium, avatar URL.

## SSRF via avatar URL
Hacker set avatar_url = `http://169.254.169.254/latest/meta-data/` (AWS IMDS). Now blocked: private IP ranges (10.x, 192.168.x, 172.16-31.x, 127.x, 169.254.x), localhost, *.local. Validated in avatar update route.

## XP farming
Self-likes blocked. Like/unlike loop now only grants XP on first like (not on unlike). Comment XP capped per post per user.

## Ban bypass
`requireAuth` now async — checks ban status every 2 min via `_banCheckedAt` cache on session.

## Session fixation
`req.session.regenerate()` called on both login and register.
