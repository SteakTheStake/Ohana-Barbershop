# Spencer's private demo

This is an opt-in demo deployment, not a production authentication shortcut.
Visitors enter **spencerohana** on the private-preview page. Access lasts 12
hours in that browser, including My Shop at `/owner` (`/admin` also leads there).
My Shop needs no email, password, SMS, or production owner account in demo mode.
Use **Lock demo** to require the password again.

The preview explains that this is an unfinished demo. A persistent notice links
the website to My Shop. Spencer can add fictional customers, create appointments,
edit their details/times/status, and try the existing shop controls.

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
2. Try an incorrect password, then `spencerohana`; confirm My Shop opens without another login.
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
