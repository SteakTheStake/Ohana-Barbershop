#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
compose() { docker compose --project-directory "$ROOT" -f "$ROOT/compose.production.yaml" "$@"; }
backup="/backups/daily-$(date -u +%Y%m%dT%H%M%SZ)-$$.enc"
compose exec -T app node scripts/backup.mjs create /data/ohana.db "$backup"
compose exec -T app node scripts/backup.mjs verify "$backup"
compose exec -T app pnpm cleanup:auth
