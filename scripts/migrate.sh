#!/usr/bin/env bash
# Applies pending database migrations. Safe to run on every deploy (see scripts/migrate.ts):
# applied migrations are skipped, one run at a time, and it refuses if files and database disagree.
#
#   scripts/migrate.sh                      # DATABASE_URL from the environment
#   scripts/migrate.sh .env.staging.local   # or from an env file (never printed)
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -gt 0 ]]; then
  if [[ ! -f "$1" ]]; then
    echo "Env file not found: $1" >&2
    exit 1
  fi
  exec pnpm exec tsx --env-file="$1" scripts/migrate.ts
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set (pass an env file or export it)." >&2
  exit 1
fi
exec pnpm exec tsx scripts/migrate.ts
