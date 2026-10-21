#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage: bash scripts/redeploy.sh (--demo | --production) [--env-file PATH] [--yes]

Run over SSH in an existing Linux deployment's Git checkout.
Fetches the current branch's upstream, fast-forwards, builds, backs up,
recreates the app/proxy, and verifies health. Never resets Git or the database.

  bash scripts/redeploy.sh --demo
  sudo bash scripts/redeploy.sh --production

--env-file PATH  Demo Compose env file (default: REPO/.env.demo).
--yes            Skip the deployment confirmation (for trusted automation).
EOF
}

fail() { echo "Error: $*" >&2; exit 1; }
compose() { docker compose --project-directory "$ROOT" "${COMPOSE_ARGS[@]}" "$@"; }

finish() {
  local status=$?
  trap - EXIT
  if [[ "${MAINTENANCE_PAUSED:-false}" == true ]]; then
    systemctl start ohana-maintenance.timer || {
      echo "WARNING: restart ohana-maintenance.timer manually." >&2
      status=1
    }
  fi
  if (( status != 0 )) && [[ "${DEPLOY_STARTED:-false}" == true ]]; then
    echo "Redeploy failed during: ${PHASE:-preflight}." >&2
    echo "No database or Git reset was performed. The checkout may have advanced." >&2
    [[ -z "${ROLLBACK_IMAGE:-}" ]] || echo "Previous image retained: $ROLLBACK_IMAGE" >&2
    [[ -z "${BACKUP:-}" ]] || echo "Backup target (check creation/verification output): $BACKUP" >&2
    echo "If services were stopped, they may still be stopped. Inspect Compose ps/logs." >&2
    echo "Do not blindly roll back after migrations; see docs/REDEPLOY.md." >&2
  fi
  exit "$status"
}

# Keep the workflow in a function so Git can update this file while it runs.
main() {
  ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
  MODE=""
  ENV_FILE=""
  CONFIRM=true
  while (( $# )); do
    case "$1" in
      --demo|--production)
        [[ -z "$MODE" ]] || fail "Choose exactly one deployment mode."
        MODE="${1#--}"; shift ;;
      --env-file)
        [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || fail "--env-file needs a path."
        ENV_FILE="$2"; shift 2 ;;
      --yes) CONFIRM=false; shift ;;
      --help|-h) usage; return ;;
      *) fail "Unknown argument: $1 (use --help)." ;;
    esac
  done
  [[ -n "$MODE" ]] || { usage >&2; exit 1; }
  [[ "$(uname -s)" == Linux ]] || fail "Run this on the Linux web server, not Windows."
  for command in git docker flock curl; do
    command -v "$command" >/dev/null || fail "Required command not found: $command"
  done
  cd -- "$ROOT"
  [[ "$(git rev-parse --show-toplevel)" == "$ROOT" ]] || fail "Use a full Git checkout."
  LOCK_DIR="$(git rev-parse --git-common-dir)"
  exec 8>"$LOCK_DIR/ohana-redeploy.lock"
  flock -n 8 || fail "Another redeploy is running in this repository."

  COMPOSE_ARGS=(-f "$ROOT/compose.$MODE.yaml")
  if [[ "$MODE" == production ]]; then
    [[ -z "$ENV_FILE" ]] || fail "--env-file is only supported for demos."
    [[ $EUID -eq 0 ]] || fail "Production redeploy requires sudo, as with initial setup."
    [[ "$(stat -c %u "$ROOT")" == 0 ]] || fail "Production requires a trusted, root-owned checkout."
    [[ -r /etc/ohana/production.env ]] || fail "Run initial production setup first."
    exec 9>/run/lock/ohana-deployment.lock
    flock -n 9 || fail "Setup, another deployment, or calendar sync is running; retry shortly."
  else
    ENV_FILE="${ENV_FILE:-$ROOT/.env.demo}"
    [[ "$ENV_FILE" == /* ]] || ENV_FILE="$PWD/$ENV_FILE"
    [[ -r "$ENV_FILE" ]] || fail "Missing demo environment file: $ENV_FILE"
    COMPOSE_ARGS=(--env-file "$ENV_FILE" "${COMPOSE_ARGS[@]}")
  fi
  docker compose version >/dev/null
  docker info >/dev/null
  [[ -z "$(git status --porcelain)" ]] || fail "Commit/stash local changes and untracked files first. Nothing will be overwritten."
  BRANCH="$(git symbolic-ref --quiet --short HEAD)" || fail "Detached HEAD: check out a tracking branch first."
  UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}')" || fail "Configure this branch's Git upstream first."
  REMOTE="$(git config --get "branch.$BRANCH.remote")"
  [[ -n "$REMOTE" && "$REMOTE" != "." ]] || fail "The branch must track a remote repository."
  compose config --quiet
  CONTAINER="$(compose ps -q --status running app)"
  [[ -n "$CONTAINER" ]] || fail "No running app found. Use the initial deployment procedure first."

  echo "Redeploy $MODE: $BRANCH from $UPSTREAM."
  echo "This fetches Git, builds Docker images, backs up data, and briefly restarts the website."
  if $CONFIRM; then
    [[ -t 0 ]] || fail "An interactive confirmation is required; use --yes for trusted automation."
    read -r -p "Continue? [yes/NO] " answer
    [[ "$answer" == yes ]] || { echo "Cancelled."; return; }
  fi
  trap finish EXIT
  DEPLOY_STARTED=true
  PHASE="Git fetch and fast-forward"
  OLD_COMMIT="$(git rev-parse HEAD)"
  git fetch --no-tags "$REMOTE"
  git merge-base --is-ancestor HEAD "$UPSTREAM" ||
    fail "Local commits are ahead of or diverge from upstream. Resolve manually; no reset was attempted."
  git merge --ff-only "$UPSTREAM"
  NEW_COMMIT="$(git rev-parse HEAD)"
  echo "Deploying $OLD_COMMIT -> $NEW_COMMIT (rebuilds even if unchanged)."

  PHASE="configuration validation and build (current containers remain running)"
  compose config --quiet
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
  ROLLBACK_IMAGE="ohana-web:pre-redeploy-$MODE-$STAMP"
  docker image tag "$(docker inspect --format '{{.Image}}' "$CONTAINER")" "$ROLLBACK_IMAGE"
  compose build app
  CADDY_CONFIG="/etc/caddy/Caddyfile"
  compose run --rm --no-deps caddy caddy validate --config "$CADDY_CONFIG" --adapter caddyfile

  PHASE="database backup"
  if [[ "$MODE" == production ]]; then
    if systemctl is-active --quiet ohana-maintenance.timer; then
      MAINTENANCE_PAUSED=true
      systemctl stop ohana-maintenance.timer
    fi
    if systemctl is-active --quiet ohana-maintenance.service; then
      fail "Maintenance is still running. Retry after it finishes."
    fi
  fi
  # Stop writers before taking the snapshot that precedes startup migrations.
  compose stop app
  if [[ "$MODE" == production ]]; then
    BACKUP="/backups/pre-redeploy-$STAMP.enc"
    compose run --rm --no-deps app node scripts/backup.mjs create /data/ohana.db "$BACKUP"
    compose run --rm --no-deps app node scripts/backup.mjs verify "$BACKUP"
  else
    BACKUP="/data/pre-redeploy-$STAMP.db"
    compose run --rm --no-deps app node --input-type=module -e '
      import { DatabaseSync, backup } from "node:sqlite";
      import { chmodSync } from "node:fs";
      import { checkDatabase } from "./scripts/backup.mjs";
      const db = new DatabaseSync("/data/ohana-demo.db", { readOnly: true });
      try { await backup(db, process.argv[1]); } finally { db.close(); }
      chmodSync(process.argv[1], 0o600);
      checkDatabase(process.argv[1]);
      console.log("Demo snapshot created and integrity checked.");
    ' "$BACKUP"
  fi
  echo "Verified pre-deploy backup: $BACKUP"
  PHASE="container recreation and health checks"
  # Recreate Caddy too: bind-mounted config content changes do not change its hash.
  compose up -d --no-build --pull never --force-recreate --wait --wait-timeout 240 app caddy
  APP_URL="$(compose exec -T app node -p 'new URL(process.env.APP_URL).origin')"
  OWNER_URL="$(compose exec -T app node -p 'new URL(process.env.OWNER_APP_URL || process.env.APP_URL).origin')"
  PHASE="public HTTPS checks"
  for url in "$APP_URL" "$OWNER_URL"; do
    [[ "$url" == https://* ]] || fail "Deployed origins must use HTTPS."
    curl --fail --silent --show-error --retry 6 --retry-all-errors --retry-delay 5 \
      --connect-timeout 10 --max-time 20 "$url/api/health" -o /dev/null
  done
  compose ps
  if [[ "${MAINTENANCE_PAUSED:-false}" == true ]]; then
    systemctl start ohana-maintenance.timer
    MAINTENANCE_PAUSED=false
  fi
  echo "Redeploy complete: $NEW_COMMIT"
  echo "Website: $APP_URL"
  echo "Previous image retained: $ROLLBACK_IMAGE"
  echo "Backup retained: $BACKUP"
}

main "$@"
