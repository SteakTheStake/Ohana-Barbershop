# Spencer's private demo

This is an opt-in demo deployment, not a production authentication shortcut.
Visitors enter **ohana26** on the private-preview page. Access lasts 12
hours in that browser, including My Shop at `/owner` (`/admin` also leads there).
My Shop needs no email, password, SMS, or production owner account in demo mode.
Use **Lock demo** to require the password again.

The preview explains that this is an unfinished demo. A persistent notice links
the website to My Shop. Spencer can add fictional customers, create appointments,
edit their details/times/status, and try the existing shop controls.

## Whole-site password protection

The password gate is implemented in the application, not browser JavaScript or
Nginx basic authentication. `src/proxy.ts` matches every route on both the
website and owner hostname. Without a valid signed demo cookie, pages and
public images redirect to `/demo`, and APIs return `401`. Client-side
navigation and prefetch requests are gated too.

Both demo Compose configurations enable this through `DEMO_MODE=true`.
Only the password page, its login/logout endpoints, compiled JS/CSS needed
to display it, and the minimal health endpoint remain publicly accessible.
Demo responses are marked private and non-cacheable. Production deployments
without demo mode keep their existing authentication; do not enable demo mode
against a production database.

`pnpm -C apps/web test:demo` covers both hostnames and forged/expired sessions.
After building, `pnpm -C apps/web test:demo:built` checks the actual Next.js
server, including unlock, authenticated pages/APIs, and logout. Docker runs
this built-app check as its non-root runtime user before accepting an image.
It uses a temporary demo database and never calls the public hostnames.

## Safety and persistence

- `DEMO_MODE=true` is required. It defaults off; normal production auth is unchanged.
- Password checking is server-side. An HTTP-only, signed, expiring cookie gates
  pages and APIs, including direct owner API calls. Password attempts are limited.
- Demo mode ignores `DATABASE_URL`. It uses `DEMO_DATABASE_URL`, defaulting to
  `file:./ohana-demo.db`; the local filename must be `ohana-demo.db`.
- Demo customers and appointments persist across restarts and are shared by all
  demo visitors. Use fictional details only, not actual customer information.
- Demo startup creates its own owner with a random, unused password and seeds
  services and sample opening hours. No production owner credentials are needed.
- SMS/customer phone sign-in and Google Calendar are disabled in code, even if
  real provider credentials are accidentally present. Public booking starts off;
  owner appointment tools still work.
- Demo responses disallow caching and search indexing. Static JS/CSS assets and
  the minimal liveness endpoint remain accessible so the gate and health checks work.
- Never point a production deployment at the demo database or reuse its signing secret.

## Old-domain deployment (Linux + Docker Compose)

Use the complete repository and a host with Docker/Compose installed.
Point the old domain's DNS to that host, allow TCP 80/443, and ensure no other
web server or production Compose stack is already using those ports. This is a
standalone configuration: **do not combine it with `compose.production.yaml`**.
If the server already runs a reverse proxy, integrate the demo with that proxy
instead of starting this Caddy service.

Create a private `.env.demo` in the repository root, with these two values:

```dotenv
DEMO_HOST=preview.your-old-domain.com
DEMO_PAYLOAD_SECRET=replace-with-a-unique-random-secret-at-least-32-characters
```

Use only the hostname, without `https://` or a path. Generate the secret locally
with `node -p "require('crypto').randomBytes(48).toString('hex')"`.
Keep `.env.demo` private (`chmod 600 .env.demo`); it is ignored by Git and Docker.
Then run:

```bash
docker compose --env-file .env.demo -f compose.demo.yaml up -d --build
```

Caddy provisions HTTPS for that domain. The app is not exposed on a public port.
Docker-managed `ohana-demo` volumes are separate from production storage; the
database volume must remain dedicated to this demo.
Do not use the production setup/reset script for a demonstration.

Verify in a private browser:

1. Open `https://YOUR_DEMO_HOST/owner` and confirm the demo/password notice appears.
2. Try an incorrect password, then `ohana26`; confirm My Shop opens without another login.
3. Add a fictional customer; book a future cut during sample opening hours,
   then edit its notes/time and confirm the changes remain after refreshing.
4. Visit the website, follow **Explore My Shop**, and try **Lock demo**.
5. In another private browser, confirm pages and `/api/owner/customers` are gated.

Stop the demo without removing its saved records:

```bash
docker compose --env-file .env.demo -f compose.demo.yaml down
```

Do not add `--volumes` unless you deliberately intend to delete the demo data.
The production Compose configuration never enables demo mode.

## Quick updates from Git

### Existing Nginx host: summitmc.xyz

This host already serves a production stack from `/opt/ohana` on port 3101.
To replace its public routing with a separate demo, while leaving that app and
its production data intact, use the launch/update helper from this checkout:

```bash
sudo bash scripts/launch-demo-nginx.sh
```

The helper uses `.env.demo` for the existing demo signing secret, forces the
website origin to `https://summitmc.xyz` and the owner origin to
`https://owner.summitmc.xyz`, and asks for confirmation before building.
It starts only the demo app on `127.0.0.1:3102`; Caddy is not started.
Demo data stays in the separate `ohana-demo` Docker volume, not production
storage. Existing HTTPS certificates and the other Nginx sites are retained.

It backs up the existing Ohana site configuration before switching routing,
then checks both origin and public HTTPS, including the demo login endpoint.
If verification fails during the switch, the previous Nginx configuration is restored.
The production app remains running on port 3101, so a routing rollback does
not require restarting it or modifying either database. The helper prints the
backup location and rollback command.

Each hostname requires its own demo login because the session cookies are
host-only. The default password is `spencerohana`; the owner workspace is at
`https://owner.summitmc.xyz/owner`.

Rerun the same helper to update a healthy demo or recover a failed initial
launch. It verifies the existing container's Compose identity and isolated data
volume. Port 3102 may be occupied only by that demo's loopback port binding.
It retains the previous demo image and builds first while the current app is
still running. It then stops only the demo app and takes an integrity-checked
SQLite backup, if a database exists, before recreating the app. Expect brief
demo downtime. It never starts Caddy or removes volumes; a previously created,
stopped Caddy container may remain unused.

An app or database rollback is never automatic because startup may apply
migrations. Failure output identifies the retained image and backup target.
Restoring Nginx configuration alone does not restore the previous demo image.
If the old routing also points to the demo on port 3102, it still needs a
working app on that port. Inspect the failure and use a matching image/database
backup for manual recovery; do not blindly start an older image.

The existing `redeploy.sh --demo`
assumes standalone Caddy and must **not** be used for this Nginx demo.
The Nginx helper rebuilds this checkout; it does not fetch or change Git.
Do not rerun production setup while these hosts should
serve the demo, because it manages their production Nginx routing.

Validate the new configuration without Docker daemon access or network calls:

```bash
node --test scripts/demo-nginx.test.mjs scripts/demo-nginx-update.test.mjs scripts/runtime-dependencies.test.mjs
```

### Standalone Caddy demo

After pushing changes, the web administrator can SSH into the server and run:

```bash
bash scripts/redeploy.sh --demo
```

This fetches and fast-forwards the current tracking branch, builds before
stopping the app, snapshots demo data, restarts, and verifies HTTPS health.
The existing `.env.demo`, signing secret, and saved demo records are retained.
See [REDEPLOY.md](REDEPLOY.md) for options, prerequisites, and recovery details.

## Local preview

Use the existing local signing secret from `pnpm setup:local`, then set
`DEMO_MODE=true` in `apps/web/.env.local` and run `pnpm dev`.
Local demo data stays in `apps/web/ohana-demo.db`, not the regular development DB.
Set `DEMO_MODE=false` and restart to return to normal development authentication.
Run `pnpm -C apps/web test:demo` for gate/session and demo workflow regressions.
