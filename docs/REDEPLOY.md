# Quick redeploy from Git

For the web administrator over SSH, not a browser-accessible shell command.
Run in the existing Linux server checkout after pushing tested changes to Git:

```bash
# Password-protected old-domain demo:
bash scripts/redeploy.sh --demo

# Real production site (after setup-production.sh has provisioned it):
sudo bash scripts/redeploy.sh --production
```

Run from any directory by using the script's absolute path if preferred.
The script asks for `yes` before fetching/building/restarting. For trusted
automation, append `--yes`. This grants the same permission as the interactive
confirmation; it does not bypass safety checks.

For a demo environment file outside the checkout:

```bash
bash scripts/redeploy.sh --demo --env-file /etc/ohana/demo.env
```

The default demo env file is the checkout's `.env.demo`. Secrets are not sourced
as shell code, printed, regenerated, or committed. Production continues to use
`/etc/ohana/production.env` through the existing Compose configuration.

## Prerequisites

- An existing running deployment using `compose.demo.yaml` or
  `compose.production.yaml`; this command does not provision a server.
- Git, Bash, `flock`, curl, Docker Engine, and Docker Compose v2 supporting
  `up --wait` and `ps --status`.
- A clean checkout on a branch tracking a remote branch (usually `origin/main`).
  Push changes from your development machine first. Ignored env files are fine.
- Server-side Git access already configured, preferably an SSH deploy key with
  read-only repository access. Do not put repository tokens in the script.
- Permission to access Docker. Production also requires root and the trusted,
  root-owned checkout used by initial setup. Docker access is effectively root
  access; do not grant it to untrusted website/demo users.

Example one-time tracking configuration, if not already set:

```bash
git branch --set-upstream-to=origin/main main
```

Choose the actual deployment branch rather than assuming it is named `main`.
The redeploy script always fetches that branch's configured remote and deploys
its upstream; it does not switch branches or accept arbitrary shell commands.

## What happens

1. Locks the checkout to prevent overlapping redeploys. Production also shares
   the existing setup/calendar-sync deployment lock.
2. Refuses dirty checkouts, detached HEADs, missing env files, or missing running
   app containers. It does not stash, reset, delete, or overwrite local edits.
3. Fetches Git and fast-forwards only. Local commits ahead of or diverging from
   upstream are rejected. The old/new commit hashes are printed.
4. Retains the running app image with a unique `ohana-web:pre-redeploy-...` tag,
   builds the new app, and validates Caddy while the old app is still running.
5. Stops the app's database writers and takes a verified pre-deploy backup.
   Production pauses its maintenance timer and refuses to proceed if maintenance
   is already running. Calendar jobs skip while the deployment lock is held.
6. Recreates app and Caddy without another build, waits up to 240 seconds for
   Compose health checks, then verifies HTTPS `/api/health` on the configured
   site and owner origins. Restores a previously active maintenance timer.

It rebuilds even if Git is unchanged, which is useful for retrying a failed
build/deployment. It does not pull newer base/proxy images deliberately; change
and test infrastructure/dependency versions separately.

Normal database startup migrations still run. No database reset, volume
removal, image pruning, credential rotation, or automatic rollback is performed.
There is brief downtime during backup/recreation; this is not blue-green
deployment. Initial setup and changes to mounts, project identity, env-file
locations, or host/systemd configuration require a separate planned operation.

## Backups and recovery

- Production: `/backups/pre-redeploy-TIMESTAMP.enc` inside the app, backed by
  `/var/lib/ohana/backups` on the host. Uses the existing encryption key and
  authenticated restore verification.
- Demo: `/data/pre-redeploy-TIMESTAMP.db` in the existing demo data volume.
  These are integrity-checked, permission-restricted **plaintext** SQLite
  snapshots. Keep demo data fictional.
- Old images and backups are retained, not automatically deleted. Monitor disk
  usage and arrange retention/off-host backups separately.

A Git/config/build failure before the stop step leaves the old containers
running, although the checkout and mutable build tag may have advanced.
A backup, startup, or public HTTPS failure returns a nonzero exit status and
prints the failed phase plus retained image/backup context. Services stopped
before that failure may remain stopped. Inspect the corresponding Compose
`ps` and `logs --tail=100` output before retrying.

Do not automatically restart an older image against a database that may have
been migrated. The printed image tag is a recovery aid, not a schema rollback.
Use a matching verified pre-deploy backup and application version with the
manual recovery process in [DEPLOYMENT.md](DEPLOYMENT.md#failure-and-recovery).
Never use `git reset --hard` or `docker compose down --volumes` as a redeploy fix.

## Script checks

No Docker daemon, Git remote, or network access is used by the mocked tests:

```bash
bash -n scripts/redeploy.sh
bash scripts/test-redeploy.sh
```

These cover the demo command ordering and rejection/failure paths. Validate
actual deployment and production backup behavior on a staging Linux server.
