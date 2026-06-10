#!/bin/sh
set -e

# Install dependencies from workspace root
pnpm install

# Build the frontend
pnpm --filter @workspace/steamshare run build

# Find and copy the dist output to the repo root
DIST=$(find . -path "*/steamshare/dist" -maxdepth 4 -type d | head -1)

if [ -z "$DIST" ]; then
  echo "ERROR: Could not find steamshare/dist after build"
  exit 1
fi

echo "Found dist at: $DIST"
mkdir -p ./dist
cp -r "$DIST/." ./dist/
echo "Copied to ./dist — contents:"
ls ./dist
