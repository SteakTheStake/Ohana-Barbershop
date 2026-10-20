#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
# Skip while deployment holds its exclusive lock; the next timer run reconciles.
exec 9>/run/lock/ohana-deployment.lock
flock -n -s 9 || exit 0
docker compose --project-directory "$ROOT" -f "$ROOT/compose.production.yaml" \
  exec -T app node scripts/calendar-sync.mjs
