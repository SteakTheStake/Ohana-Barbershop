#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() { echo "Error: $*" >&2; exit 1; }
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SITE=/etc/nginx/sites-available/ohana-summitmc.conf
SWITCHED=false
VERIFIED=false
ROLLBACK_IMAGE=""
DATA_BACKUP=""
DEMO_CHANGED=false

compose() {
  docker compose --project-directory "$ROOT" --env-file "$ROOT/.env.demo" \
    -f "$ROOT/compose.demo.yaml" -f "$ROOT/compose.demo.nginx.yaml" "$@"
}

finish() {
  local status=$?
  trap - EXIT
  if [[ "$SWITCHED" == true && "$VERIFIED" != true ]]; then
    echo "Demo verification failed; restoring the previous Nginx routing." >&2
    if cp -p -- "$BACKUP/site.conf" "$SITE" && nginx -t && systemctl reload nginx; then
      echo "Previous Nginx configuration restored. App image/database were not rolled back." >&2
    else
      echo "WARNING: restore $BACKUP/site.conf to $SITE and reload Nginx manually." >&2
    fi
    status=1
  fi
  if (( status != 0 )); then
    [[ -z "$ROLLBACK_IMAGE" ]] || echo "Previous demo image retained: $ROLLBACK_IMAGE" >&2
    [[ -z "$DATA_BACKUP" ]] || echo "Demo backup target (check verification output): $DATA_BACKUP" >&2
    if [[ "$DEMO_CHANGED" == true ]]; then
      echo "Demo may be stopped or unhealthy. Inspect Compose ps/logs before retrying." >&2
      echo "No automatic image/database rollback: startup may have applied migrations." >&2
    fi
  fi
  exit "$status"
}

[[ $# -eq 0 ]] || fail "Usage: sudo bash scripts/launch-demo-nginx.sh"
[[ $EUID -eq 0 ]] || fail "Run locally with sudo; do not put passwords in the command."
for command in docker curl nginx systemctl flock ss; do
  command -v "$command" >/dev/null || fail "Missing command: $command"
done
[[ -r "$ROOT/.env.demo" ]] || fail "Missing .env.demo (see docs/DEMO.md)."
[[ -f "$SITE" ]] || fail "Expected existing Nginx site: $SITE"
[[ "$(readlink -f /etc/nginx/sites-enabled/ohana-summitmc.conf)" == "$SITE" ]] ||
  fail "Expected the existing enabled Ohana Nginx site."
[[ -r /etc/letsencrypt/live/ohana-summitmc/fullchain.pem &&
   -r /etc/letsencrypt/live/ohana-summitmc/privkey.pem ]] ||
  fail "Existing certificate/key missing."
exec 9>/run/lock/ohana-deployment.lock
flock -n 9 || fail "Another deployment/maintenance task is running."
export DEMO_HOST=summitmc.xyz DEMO_OWNER_HOST=owner.summitmc.xyz
docker info >/dev/null
compose config --quiet
nginx -t
EXISTING_APP="$(compose ps -aq app)"
if [[ -n "$EXISTING_APP" ]]; then
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}:{{index .Config.Labels "com.docker.compose.service"}}' "$EXISTING_APP")" == ohana-demo:app ]] ||
    fail "Existing container is not the expected demo app. Inspect manually."
  [[ "$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Type}}:{{.Name}}{{end}}{{end}}' "$EXISTING_APP")" == volume:ohana-demo_demo-data ]] ||
    fail "Existing demo does not use the expected isolated data volume. Inspect manually."
fi
LISTENERS="$(ss -H -ltn 'sport = :3102')"
if [[ -n "$LISTENERS" ]]; then
  [[ -n "$EXISTING_APP" ]] &&
    [[ "$(docker inspect --format '{{range index .NetworkSettings.Ports "3000/tcp"}}{{.HostIp}}:{{.HostPort}}{{end}}' "$EXISTING_APP")" == 127.0.0.1:3102 ]] ||
    fail "Port 3102 is occupied by something other than the existing demo app."
fi
[[ -t 0 ]] || fail "Run in an interactive terminal."
echo "This builds a separate demo and switches summitmc.xyz and owner.summitmc.xyz to it."
echo "Production stays running on port 3101; its database and credentials are not changed."
if [[ -n "$EXISTING_APP" ]]; then
  echo "The existing demo app will be stopped after building, its database backed up, and its container recreated."
  echo "There will be brief demo downtime during backup and recreation."
fi
echo "Docker may download dependencies/images. HTTPS checks contact both public hostnames."
read -r -p "Launch the demo on both hostnames? [yes/NO] " answer
[[ "$answer" == yes ]] || { echo "Cancelled."; exit 0; }

trap finish EXIT
STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
if [[ -n "$EXISTING_APP" ]]; then
  ROLLBACK_IMAGE="ohana-web:pre-demo-update-$STAMP"
  docker image tag "$(docker inspect --format '{{.Image}}' "$EXISTING_APP")" "$ROLLBACK_IMAGE"
fi
compose build app
if [[ -n "$EXISTING_APP" ]]; then
  DEMO_CHANGED=true
  compose stop app
  DATA_BACKUP="/data/pre-demo-update-$STAMP.db"
  compose run --rm --no-deps app node --input-type=module -e '
    import { existsSync, chmodSync } from "node:fs";
    import { DatabaseSync, backup } from "node:sqlite";
    import { checkDatabase } from "./scripts/backup.mjs";
    const source = "/data/ohana-demo.db";
    if (existsSync(source)) {
      const target = process.argv[1];
      const db = new DatabaseSync(source, { readOnly: true });
      try { await backup(db, target); } finally { db.close(); }
      chmodSync(target, 0o600);
      checkDatabase(target);
      console.log(`Verified demo backup retained at ${target}`);
    } else {
      console.log("Demo database does not exist yet; no saved records to back up.");
    }
  ' "$DATA_BACKUP"
fi
DEMO_CHANGED=true
compose up -d --no-build --wait --wait-timeout 300 app
compose exec -T app node -e '
  const env = process.env;
  if (env.DEMO_MODE !== "true" || (env.PAYLOAD_SECRET?.length ?? 0) < 32 ||
      env.DEMO_DATABASE_URL !== "file:/data/ohana-demo.db" ||
      env.SMS_PROVIDER !== "disabled" || env.GOOGLE_CALENDAR_ENABLED !== "false") {
    console.error("Demo isolation or signing-secret validation failed.");
    process.exit(1);
  }
'

# Check the password gate before changing any live routing.
for host in summitmc.xyz owner.summitmc.xyz; do
  curl --fail --silent --show-error --max-time 30 \
    -H "Host: $host" http://127.0.0.1:3102/api/health -o /dev/null
  curl --fail --silent --show-error --max-time 30 \
    -H "Host: $host" http://127.0.0.1:3102/demo | grep 'Demo password' >/dev/null
done

BACKUP="/var/backups/ohana-demo-switch/$(date -u +%Y%m%dT%H%M%SZ)-$$"
install -d -m 700 "$BACKUP"
cp -p -- "$SITE" "$BACKUP/site.conf"
echo "Previous Nginx configuration saved to: $BACKUP/site.conf"
install -m 644 "$ROOT/deploy/nginx-demo-proxy.conf" /etc/nginx/snippets/ohana-demo-proxy.conf
SWITCHED=true
install -m 644 "$ROOT/deploy/nginx-demo.conf" "$SITE"
nginx -t
systemctl reload nginx

for host in summitmc.xyz owner.summitmc.xyz; do
  for route in origin public; do
    args=()
    [[ "$route" != origin ]] || args=(--resolve "$host:443:127.0.0.1")
    curl --fail --silent --show-error --retry 3 --retry-all-errors \
      --connect-timeout 10 --max-time 30 "${args[@]}" "https://$host/api/health" -o /dev/null
    curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
      "${args[@]}" "https://$host/demo" | grep 'Demo password' >/dev/null
    status="$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
      "${args[@]}" -o /dev/null -w '%{http_code}' \
      -X POST -H "Origin: https://$host" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data 'password=deliberately-invalid-deployment-check&next=%2F' "https://$host/api/demo")"
    [[ "$status" == 303 ]] || fail "$route $host demo login endpoint returned $status, expected 303."
  done
done
VERIFIED=true
echo "Demo live: https://summitmc.xyz"
echo "Owner workspace: https://owner.summitmc.xyz/owner"
echo "Demo password: the configured demo password (default documented in docs/DEMO.md)."
echo "Production is still running, unrouted, on 127.0.0.1:3101."
[[ -z "$ROLLBACK_IMAGE" ]] || echo "Previous demo image retained: $ROLLBACK_IMAGE (do not roll back across migrations blindly)."
echo "Rollback: sudo cp -p '$BACKUP/site.conf' '$SITE' && sudo nginx -t && sudo systemctl reload nginx"
