#!/usr/bin/env bash
set -euo pipefail

# Render's filesystem is read-only under /usr/bin, so corepack enable fails.
# Install pnpm to a writable global path instead.
npm install -g pnpm@11.5.2

pnpm install --frozen-lockfile
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/steamshare run build
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/db run push-force
