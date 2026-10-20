#!/usr/bin/env bash
# Run from a complete checkout: sudo bash scripts/setup-production.sh --reset-database
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
RESET=false
case "${1:-}" in
  "") ;;
  --reset-database) RESET=true ;;
  --help|-h)
    echo "Usage: sudo bash scripts/setup-production.sh [--reset-database]"
    echo "Installs Docker if needed, builds, configures HTTPS and daily backups."
    echo "Reset requires a separate typed confirmation; existing data is backed up."
    exit 0 ;;
  *) echo "Unknown argument. Use --help." >&2; exit 1 ;;
esac
[[ $# -le 1 ]] || { echo "Use --help." >&2; exit 1; }
[[ "$(uname -s)" == Linux && $EUID -eq 0 ]] || {
  echo "Run with sudo on a Linux server, not on your local Windows machine." >&2; exit 1;
}
[[ -d /run/systemd/system ]] || { echo "A systemd-based server is required." >&2; exit 1; }
exec 9>/run/lock/ohana-deployment.lock
flock -n 9 || { echo "Another Ohana deployment is running." >&2; exit 1; }
[[ "$ROOT" != *[[:space:]]* && "$ROOT" != *%* ]] || {
  echo "Place the checkout at a path without whitespace or % (for example /opt/ohana)." >&2; exit 1;
}
[[ -f "$ROOT/compose.production.yaml" && -f "$ROOT/pnpm-lock.yaml" ]] || exit 1
# This directory becomes root-executed systemd configuration.
[[ "$(stat -c %u "$ROOT")" == 0 && ! -L "$ROOT" ]] || {
  echo "Use a root-owned checkout, e.g. /opt/ohana; do not run from a user-writable directory." >&2; exit 1;
}
source /etc/os-release
case "$ID:${VERSION_ID%%.*}" in
  ubuntu:24|ubuntu:26|debian:12|debian:13) ;;
  *) echo "Supported: Ubuntu 24.04/26.04 or Debian 12/13." >&2; exit 1 ;;
esac
[[ -r /dev/tty ]] || { echo "An interactive terminal is required." >&2; exit 1; }
echo "This will download packages/images, configure Docker and systemd, and publish:"
echo "  https://www.ohana-barbershop.com"
echo "  https://www.owner.ohana-barbershop.com"
echo "Before continuing: point BOTH DNS names to this server and open TCP 80/443."
echo "Use a dedicated server: existing websites on ports 80/443 will conflict."
read -r -p "Continue with these system and network changes? [yes/NO] " answer </dev/tty
[[ "$answer" == yes ]] || exit 1
if $RESET; then
  echo "RESET removes all live appointments, customers, users and shop settings."
  echo "Only /var/lib/ohana/data is reset. Local/development databases are untouched."
  read -r -p "Type RESET OHANA DATABASE to confirm: " answer </dev/tty
  [[ "$answer" == "RESET OHANA DATABASE" ]] || exit 1
fi
trap 'echo "Setup failed. Data/secrets were not deleted. Check: docker compose -f \"$ROOT/compose.production.yaml\" logs --tail=100" >&2' ERR

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl openssl
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  # Use Docker's signed distribution repository, not a curl-to-shell installer.
  install -d -m 0755 /etc/apt/keyrings
  curl --fail --silent --show-error --location "https://download.docker.com/linux/$ID/gpg" \
    -o /etc/apt/keyrings/ohana-docker.asc
  chmod 0644 /etc/apt/keyrings/ohana-docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/ohana-docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "${UBUNTU_CODENAME:-$VERSION_CODENAME}" \
    > /etc/apt/sources.list.d/ohana-docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker info >/dev/null
for domain in www.ohana-barbershop.com www.owner.ohana-barbershop.com; do
  getent ahosts "$domain" >/dev/null || { echo "No DNS address found for $domain." >&2; exit 1; }
done

install -d -m 0700 /etc/ohana /var/lib/ohana /var/lib/ohana/reset-archive
if [[ ! -e /etc/ohana/production.env ]]; then
  [[ ! -f /var/lib/ohana/data/ohana.db ]] || {
    echo "Existing production DB has no secrets file. Restore /etc/ohana/production.env first." >&2; exit 1;
  }
  read -r -p "Owner login email: " email </dev/tty
  [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]] || {
    echo "Enter a valid email address." >&2; exit 1;
  }
  read -r -p "Twilio Account SID (AC...): " account </dev/tty
  read -r -s -p "Twilio Auth Token: " token </dev/tty; echo
  read -r -p "Twilio Verify Service SID (VA...): " verify </dev/tty
  [[ "$account" =~ ^AC[0-9a-fA-F]{32}$ && "$token" =~ ^[0-9a-fA-F]{32}$ && "$verify" =~ ^VA[0-9a-fA-F]{32}$ ]] || {
    echo "Invalid Twilio credentials. Create a Twilio Verify service first." >&2; exit 1;
  }
  secret="$(openssl rand -hex 48)"
  password="$(openssl rand -hex 24)"
  key="$(openssl rand -hex 32)"
  env_tmp="$(mktemp /etc/ohana/production.env.XXXXXX)"
  printf '%s\n' "PAYLOAD_SECRET=$secret" "CMS_ADMIN_EMAIL=$email" \
    "CMS_ADMIN_PASSWORD=$password" "BACKUP_KEY=$key" \
    "TWILIO_ACCOUNT_SID=$account" "TWILIO_AUTH_TOKEN=$token" \
    "TWILIO_VERIFY_SERVICE_SID=$verify" > "$env_tmp"
  mv "$env_tmp" /etc/ohana/production.env
  unset token secret password key
  echo "Credentials generated in /etc/ohana/production.env (root-only)."
else
  echo "Keeping existing production credentials, including owner bootstrap password."
fi
chmod 0600 /etc/ohana/production.env
if ! grep -q '^GOOGLE_CALENDAR_SYNC_SECRET=' /etc/ohana/production.env; then
  printf '\nGOOGLE_CALENDAR_SYNC_SECRET=%s\n' "$(openssl rand -hex 32)" >> /etc/ohana/production.env
fi
if ! grep -q '^GOOGLE_CALENDAR_NAMESPACE=' /etc/ohana/production.env; then
  printf 'GOOGLE_CALENDAR_NAMESPACE=%s\n' "$(openssl rand -hex 16)" >> /etc/ohana/production.env
fi
for name in PAYLOAD_SECRET CMS_ADMIN_EMAIL CMS_ADMIN_PASSWORD BACKUP_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_VERIFY_SERVICE_SID; do
  grep -Eq "^${name}=.+" /etc/ohana/production.env || {
    echo "Missing $name in /etc/ohana/production.env; fix it and rerun." >&2; exit 1;
  }
done
install -d -m 0700 -o 1000 -g 1000 /var/lib/ohana/data /var/lib/ohana/backups
compose() { docker compose --project-directory "$ROOT" -f "$ROOT/compose.production.yaml" "$@"; }
compose config --quiet
compose build --pull app
compose pull caddy
compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# Build first so a failed build never takes the running shop offline.
systemctl stop ohana-maintenance.timer 2>/dev/null || true
if systemctl is-active --quiet ohana-maintenance.service; then
  echo "Maintenance is running. Wait for it to finish, then rerun setup." >&2; exit 1
fi
compose stop caddy app
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
if [[ -f /var/lib/ohana/data/ohana.db ]]; then
  backup="/backups/pre-deploy-$stamp.enc"
  compose run --rm --no-deps app node scripts/backup.mjs create /data/ohana.db "$backup"
  compose run --rm --no-deps app node scripts/backup.mjs verify "$backup"
fi
if $RESET; then
  # Retain even the original WAL/SHM files rather than deleting anything.
  mv /var/lib/ohana/data "/var/lib/ohana/reset-archive/$stamp"
  install -d -m 0700 -o 1000 -g 1000 /var/lib/ohana/data
  echo "Old database directory archived at /var/lib/ohana/reset-archive/$stamp"
fi
compose up -d --wait --wait-timeout 240

cat > /etc/systemd/system/ohana-maintenance.service <<EOF
[Unit]
Description=Ohana encrypted database backup and expired auth cleanup
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=$ROOT
ExecStart=/usr/bin/bash $ROOT/scripts/production-maintenance.sh
UMask=0077
EOF
cat > /etc/systemd/system/ohana-maintenance.timer <<'EOF'
[Unit]
Description=Daily Ohana backup and cleanup

[Timer]
OnCalendar=*-*-* 10:00:00 UTC
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now ohana-maintenance.timer
systemctl start ohana-maintenance.service

cat > /etc/systemd/system/ohana-calendar-sync.service <<EOF
[Unit]
Description=Ohana Google Calendar reconciliation and conflict monitoring
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=$ROOT
ExecStart=/usr/bin/bash $ROOT/scripts/production-calendar-sync.sh
TimeoutStartSec=90
UMask=0077
EOF
cat > /etc/systemd/system/ohana-calendar-sync.timer <<'EOF'
[Unit]
Description=Recover Ohana calendar synchronization every 30 seconds

[Timer]
OnBootSec=30
OnUnitInactiveSec=30
AccuracySec=1
RandomizedDelaySec=5

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now ohana-calendar-sync.timer

# Real TLS verification, not curl -k. Caddy may need time for initial issuance.
for url in \
  https://www.ohana-barbershop.com/api/health \
  https://www.owner.ohana-barbershop.com/api/health \
  https://www.ohana-barbershop.com/ \
  https://www.owner.ohana-barbershop.com/owner; do
  curl --fail --silent --show-error --location --retry 12 --retry-all-errors \
    --retry-delay 5 --connect-timeout 10 --max-time 20 "$url" -o /dev/null
done
echo
echo "Production is running with verified HTTPS on both domains."
echo "Owner login: https://www.owner.ohana-barbershop.com/owner"
echo "Read initial CMS_ADMIN_EMAIL / CMS_ADMIN_PASSWORD in /etc/ohana/production.env."
echo "Review services, hours and policy in My Shop before enabling online booking."
echo "Escrow BACKUP_KEY separately and copy /var/lib/ohana/backups off-host."
echo "Monitor: systemctl status ohana-maintenance.timer; journalctl -u ohana-maintenance"
echo "Calendar: systemctl status ohana-calendar-sync.timer; journalctl -u ohana-calendar-sync"
echo "Google integration stays off until configured. Follow docs/ROSIE_INTEGRATION.md before changing Rosie."
echo "No real SMS was sent; verify Twilio delivery manually before opening bookings."
