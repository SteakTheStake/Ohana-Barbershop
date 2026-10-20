# Ohana production deployment

The current application is Next.js + Payload CMS + SQLite, not a static site
or Easy!Appointments. Use one Linux server with local persistent storage.

For Rosie's opt-in Google Calendar bridge, follow
[ROSIE_INTEGRATION.md](ROSIE_INTEGRATION.md) before cutover. The installer generates
missing calendar namespace/sync-secret values and installs a 30-second recovery
timer. Google credentials and Rosie account settings are not provisioned. The
safe default is Rosie sending Ohana booking links; direct Google booking requires
explicit non-atomic-booking acknowledgement. Monitor the authenticated calendar
readiness endpoint separately from process/database liveness.

## One-command setup

Supported: Ubuntu 24.04/26.04 or Debian 12/13 with systemd, sudo/root access,
and a complete, root-owned checkout at a stable location such as `/opt/ohana`.
Use a dedicated server with at least 4 GB RAM and enough disk for builds,
images and backups. Installation downloads signed Docker packages when needed,
Node dependencies/images, and Google fonts used by the current app.

Before running:

1. Copy the complete current project to `/opt/ohana` (including new/uncommitted
   implementation files). A clone only contains changes already committed/pushed.
   Keep the checkout and its parents root-owned and not writable by other users.
2. Point DNS A records for `www.ohana-barbershop.com` and
   `www.owner.ohana-barbershop.com` to the server's public IPv4 address.
   Only add AAAA records if IPv6 actually reaches this server.
3. Permit inbound TCP 80 and 443 at the provider firewall/NAT; retain SSH access.
   Do not run another web server on those ports. The installer does not change
   firewall rules. Docker-published ports can bypass UFW; use a provider firewall.
4. Have an owner email and Twilio Account SID, Auth Token, and Verify Service SID.
   Twilio Verify SMS must be configured and funded; trial accounts restrict
   recipients. The script validates credential format, not delivery or billing.

Run on the Linux server, from that checkout:

```bash
sudo bash scripts/setup-production.sh --reset-database
```

The script confirms system/network changes and requires typing
`RESET OHANA DATABASE` before a reset. There is intentionally no silent/force
reset flag. It affects **only** `/var/lib/ohana/data`, never a development DB or
an unrelated existing database. Migrating an older external DB is a separate task.

The installer:

- Installs Docker Engine/Compose if missing and enables Docker at boot.
- Generates root-only production credentials in `/etc/ohana/production.env`.
- Builds a Node 24 production image without local `.env`, databases or dev caches.
- Validates Caddy config and builds before stopping a running deployment.
- Stops writers; backs up and restore-verifies an existing database before changes.
- On reset, moves the entire old DB directory (including WAL/SHM) into a protected
  archive instead of deleting it. Starts a fresh production DB with migrations,
  one owner and seeded services.
- Starts the non-root app with no published app port, and Caddy on 80/443 with
  automatic HTTPS/certificate renewal. Only the proxy is publicly reachable.
- Installs daily encrypted backup/restore verification and auth cleanup via
  systemd, runs it once, and checks both hosts using real HTTPS verification.

Use the exact requested addresses:

- Main site: https://www.ohana-barbershop.com/
- Owner panel: https://www.owner.ohana-barbershop.com/ (redirects to `/owner`)
- Advanced CMS: https://www.owner.ohana-barbershop.com/admin/collections/appointments

Main-site `/owner` and `/admin` URLs redirect to the owner host. Raw Payload and
owner APIs are not served on the main host. Customer booking/calendar endpoints
remain on the main host. Both hosts use the same app and DB; owner cookies are
host-only. `OWNER_APP_URL` defaults to `APP_URL` outside this deployment, preserving
local development. Owner mutations check the configured owner origin.

The bare apex `ohana-barbershop.com` and `owner.ohana-barbershop.com` are not
configured aliases. Add explicit Caddy redirects and DNS if you want them;
the installer only provisions the two `www` names requested. A wildcard
`*.ohana-barbershop.com` certificate does not cover `www.owner...`; Caddy obtains
certificates for the exact names.

## First login and launch

Read `CMS_ADMIN_EMAIL` and `CMS_ADMIN_PASSWORD` in `/etc/ohana/production.env`
on the server (root only). Do not paste secrets into chat, logs or version control.
Change the initial password using advanced CMS user administration.
Existing owner passwords are never changed by rerunning the installer; after
a DB reset, the bootstrap credentials in that file are used again.

**Online booking intentionally starts disabled.** Review service prices and
durations, working hours, cancellation policy and Pacific timezone in My Shop,
test a real SMS/customer login with consent, then enable booking.
The installer does not send SMS, create appointments or enable bookings.

Email password-reset delivery is not configured by this project. Configure an
email adapter/recovery procedure before relying on email recovery. This installer
does not modify email/MX records, DNS provider accounts or registrar settings.

## Updates without a reset

Update the checkout and run:

```bash
sudo bash scripts/setup-production.sh
```

Credentials, customer data and owner account remain unchanged; an encrypted
pre-deploy backup is still made. Do not change `PAYLOAD_SECRET` or `BACKUP_KEY`
on routine updates. Update image versions/dependencies deliberately, test first,
and retain the previous image and backup before upgrading. Deployments briefly
stop the app while backing up/restarting; this is not zero-downtime deployment.
If Docker distro packages conflict with an existing Docker installation, resolve
the conflict manually; the script will not uninstall an existing runtime.

## Persistent files and monitoring

| Host path | Purpose |
| --- | --- |
| `/etc/ohana/production.env` | Owner bootstrap, Payload, Twilio and backup secrets (0600) |
| `/var/lib/ohana/data/ohana.db` | Live SQLite DB, mounted at `/data` (UID 1000) |
| `/var/lib/ohana/backups` | AES-256-GCM encrypted, integrity-checked backups |
| `/var/lib/ohana/reset-archive` | Root-protected original data directories after resets |
| `/var/lib/ohana/caddy-data` | Persistent TLS accounts/certificates |
| `/var/lib/ohana/caddy-config` | Caddy state |

Daily maintenance runs around 10:00 UTC. Backups are deliberately never deleted
automatically. Monitor disk space, backup failures and HTTPS availability; establish
a retention policy and copy encrypted backups off-host. Escrow `BACKUP_KEY`
separately: encrypted backups are useless without it. Protected reset archives
contain plaintext private data; arrange secure retention/removal after recovery
is verified. Local backup alone is not disaster recovery.

From the checkout:

```bash
sudo docker compose -f compose.production.yaml ps
sudo docker compose -f compose.production.yaml logs --tail=100
sudo systemctl status ohana-maintenance.timer
sudo journalctl -u ohana-maintenance.service
sudo systemctl start ohana-maintenance.service
```

Container health checks run every 30 seconds. Docker restarts crashed processes,
but an unhealthy process that has not exited needs operator intervention.
Set up external uptime monitoring and alerting; no monitoring account or off-host
backup destination is created automatically. Avoid logging private calendar URLs.

## Failure and recovery

If the script fails, read its output and container logs. Do not repeatedly reset.
A failure during build leaves the existing deployment running. Failures after
the stop step can leave it stopped; inspect the cause before using
`sudo docker compose -f compose.production.yaml up -d`.
If maintenance was paused, re-enable it after recovery.

For TLS failures, verify both DNS names (including stale AAAA records), TCP 80/443,
DNS CAA authorization for Caddy's certificate issuers, and Caddy logs. Do not
bypass certificate validation. Repeated failed issuance may trigger CA rate limits.

Restore to a NEW database file using the existing authenticated backup tool,
not by copying a live WAL database. For example, from the checkout:

```bash
sudo docker compose -f compose.production.yaml stop caddy app
sudo docker compose -f compose.production.yaml run --rm --no-deps app \
  node scripts/backup.mjs restore /backups/CHOSEN.enc /data/recovered.db
```

The restore refuses to overwrite an existing file and checks integrity.
While all writers remain stopped, an operator can archive the current data
directory, create a fresh UID-1000-owned directory and put the verified recovered
file there as `ohana.db`. Do not reuse WAL/SHM files from a different DB.
Then start the app/proxy and verify owner login, appointments and health.
Use the matching application image for a rollback across schema changes.
Never blindly replace the DB or run `docker compose down -v`.

See [OHANA_CMS.md](OHANA_CMS.md) and [RELIABILITY.md](RELIABILITY.md) for the data
model, migrations, backup encryption and operational limitations.
