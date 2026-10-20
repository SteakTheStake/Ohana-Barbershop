# Ohana CMS & Scheduling

This is the current implementation guide. It supersedes the earlier static-site,
external scheduling embed, and Easy!Appointments plans. Historical documents are
retained for context, not as current deployment instructions.

## Foundation

[Payload CMS](https://github.com/payloadcms/payload) is free, MIT-licensed,
self-hostable, and integrates with Next.js. References:

- https://payloadcms.com/get-started
- https://payloadcms.com/docs/database/sqlite
- https://payloadcms.com/docs/authentication/overview

Payload supplies the owner admin UI, schema, authentication for staff, access
control, REST API, migrations, and database operations. Ohana's custom code
implements scheduling and phone-verified customer sessions. This is not an
external scheduler or a rebranded iframe.

The app uses compatible Payload 3.91 / Next.js 16.3 versions. The old Next.js 15
Windows font patch is no longer applied. Tailwind and the existing Ohana design
are retained.

## Local Setup

```sh
pnpm install
pnpm setup:local
pnpm dev
```

Use Node 22.16+ or newer. Setup generates random secrets and an owner password in
`apps/web/.env.local`, with `SMS_PROVIDER=console`. It never overwrites a file.
Open that file locally to find your owner credentials. Never commit it.

The SQLite database is created on first request. Visit `/owner` to sign in.
The owner workspace has Schedule, Customers, and Shop tabs, with large touch
targets and guided forms. `/admin` redirects to it; advanced Payload collection
screens remain available from Shop. See [BARBER_GUIDE.md](BARBER_GUIDE.md) for
non-technical, day-to-day instructions.
Phone login is for customers only; it cannot grant owner access.

Before accepting appointments:

1. Review services: price is in cents, duration/buffer in five-minute multiples.
   Initial prices come from the existing menu; durations are provisional.
2. In Ohana Booking Settings add each open weekday, opening and closing times
   in 24-hour `HH:mm` format. All schedules use America/Los_Angeles, including DST.
   Omitted/closed weekdays have no availability. Overnight hours are unsupported.
3. Confirm booking horizon, lead time and cancellation policy (initially 24 hours).
4. Enter existing future appointments in the owner CMS before enabling booking.
   No data has been imported from the previous scheduling provider; that account
   and subscription have not been changed. The owner may enter appointments while
   public booking is off, within the configured hours and up to a year ahead.
5. Set a public announcement if desired, then enable booking.
6. Add lunch breaks and holidays with Block time. Up to 31 days fit in one block.

No business hours are invented or silently enabled. Disabling booking stops
new visits and rescheduling; existing customers can still sign in and cancel
according to policy. Owner appointment creation obeys working hours, service
duration, buffers, and collision protection, but ignores the public lead time,
uses a one-year horizon, and is allowed while the public booking switch is off.

## Customer Flow

`/book?service=haircut` preselects a service. The customer chooses a date and
available time, verifies a mobile number, and confirms. The UI never treats a
selected slot as reserved until the server commits the appointment.

`/account` shows only the authenticated customer's latest 100 visits, with
calendar download, policy-aware cancellation and rescheduling. Rescheduling
updates the same visit atomically; a failed change retains the original time.
Calendar downloads are snapshots, not live calendar subscriptions.

Prices and service names are snapshotted from the trusted service record at
booking (or an owner changing the service), not accepted from the browser.
Time-only reschedules retain the originally quoted price. No payment is collected:
customers pay at the shop. Confirmation is visible in the account and on-screen.
Automated appointment/reminder SMS, emails, deposits, merch, and multiple barbers
are not implemented.

## Owner Calendar Feed

For the optional Rosie/Google Calendar API bridge (live external busy checks and
scheduled publishing), see [ROSIE_INTEGRATION.md](ROSIE_INTEGRATION.md). It is
disabled by default and is separate from the read-only feed described here.

The Shop tab exposes a private iCalendar feed at `/api/calendar/<token>` for
subscribing in Google Calendar ("From URL"), Apple Calendar, or Outlook. The
URL is a bearer secret: anyone holding it can read upcoming bookings, customer
names, and phones. The token is 256 bits stored in the Payload KV table, is
created on first owner request, and can be rotated from the Shop tab; rotation
invalidates the old link. The feed omits cancelled visits, includes time-off
blocks, and covers the last two weeks plus all future bookings. It is served
from `APP_URL`, so subscription only works once the site is publicly reachable.
Google refreshes subscribed calendars on its own schedule (hours or longer);
per-visit "Add to Google Calendar" template links create independent snapshots
that do not follow reschedules/cancellations and can duplicate subscriptions.

## Phone Authentication

Development mode returns a random six-digit test code to the local UI. It never
sends a text and is not production authentication.

For production, create a Twilio **Verify Service** and set these server-only
environment variables:

```dotenv
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
```

Do not use `NEXT_PUBLIC_` for credentials. Twilio Verify/SMS has usage charges;
Payload has no CMS license fee. Trial accounts may only send to approved numbers.
Configure Twilio's geographic permissions and fraud protection before launch.
No real texts are sent by the automated tests.

Verification is limited by phone and IP. Challenges expire in five minutes and
are single-use. Codes are checked by Twilio; development codes are HMAC-hashed.
Opaque random session tokens are hashed in the database, expire after 14 days,
and use HttpOnly, SameSite=Strict cookies with Secure enabled in production.
Logout revokes the server-side session. Changing a customer's phone number
also revokes their existing customer sessions within the same transaction.

Production rejects the console provider and requires HTTPS. Customer APIs check
mutation Origin against `APP_URL`; records are accessed through explicit,
ownership-checked endpoints rather than public Payload collection access.
Owner notes and internal authentication collections are not exposed.

## Hosting & Migrations

This is a **Node server**, not a static export. GitHub Pages and the repository's
legacy root HTML cannot host its backend. Do not deploy `apps/web/out`.
Use one always-on Node process with a persistent local disk and an HTTPS reverse
proxy. Ephemeral filesystem/serverless deployment is unsupported with this SQLite
configuration. Do not horizontally scale or share SQLite across network mounts.

For a one-command Linux install with both public and owner HTTPS hosts, encrypted
backups and a confirmation-gated reset, follow [DEPLOYMENT.md](DEPLOYMENT.md).
The manual environment/build steps here are an alternative to that installer.

Set production environment variables before building:

```dotenv
NODE_ENV=production
PAYLOAD_SECRET=<at least 32 random characters; retain across deployments>
DATABASE_URL=file:/var/lib/ohana/ohana.db
APP_URL=https://www.ohana-barbershop.com
OWNER_APP_URL=https://www.owner.ohana-barbershop.com
SMS_PROVIDER=twilio
CMS_ADMIN_EMAIL=<owner email>
CMS_ADMIN_PASSWORD=<14+ character random initial password>
TRUST_PROXY=true
```

Also set the three Twilio credentials. `TRUST_PROXY=true` is safe ONLY when your
proxy strips/overwrites `X-Forwarded-For` and the app is not directly reachable.
With it false, callers share a conservative global IP throttle.
Use a dedicated database path; create its parent directory with restricted access.
Keep production secrets separate from the generated development `.env.local`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm -C apps/web start
```

The checked-in initial migration applies automatically on production startup,
before owner/service initialization. Development uses Payload's schema push.
Always back up before applying future migrations. Generate and review new
migrations with `pnpm -C apps/web payload migrate:create`; do not run destructive
reset/fresh commands on a real database. Test migrations on a copied database first.

The initial owner is provisioned before the admin is served; there is no
unclaimed public owner signup. Existing owner passwords are never reset from
environment variables. Change the initial password in the admin and remove the
bootstrap password from manual deployment secrets afterward. The Linux installer's
protected secrets file retains it for explicitly requested future DB resets.
Email password reset
delivery is not configured; arrange an email adapter/recovery procedure before
production use. Payload's default email adapter only logs locally.

SQLite transactions are explicitly enabled. Each occupied five-minute cell has
a unique database key. Appointment/time-off writes and their occupancy changes
commit or roll back together, including owner admin edits. A single-writer queue
prevents local concurrent transactions from failing with SQLITE_BUSY. Locks are
retained for completed/no-show visits and removed for cancellations/time-off
deletions. Deleting services/customers with visit history is blocked.

Back up the database using SQLite's online backup API or `sqlite3 .backup`.
Do not copy only `ohana.db` during live WAL writes. Encrypt backups and restrict
access: phone numbers and visit notes are personal information. Test restoration.

Schedule daily cleanup of expired authentication/rate-limit records:

```sh
pnpm -C apps/web cleanup:auth
```

Retain appointment history independently. Customer deletion/anonymization with
historical visits needs an explicit retention/privacy workflow before production.

## Verification

For save receipts, owner revision checks, audit history, encrypted backups,
health monitoring and the launch/recovery checklist, see
[RELIABILITY.md](RELIABILITY.md). These safeguards do not provision hosting,
an off-host backup destination, monitoring accounts, or reset-email delivery.

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm -C apps/web test:browser
```

Tests use temporary SQLite databases and never touch the shop database. Coverage
includes Pacific DST, duration/buffer overlap, transaction rollback, concurrent
bookings, time off, phone code replay/throttling, CSRF, session revocation, and
cross-customer privacy. Live Twilio delivery and production hosting must be
verified separately with the owner's credentials and consent.

Browser tests mock customer API responses and exercise the UI on desktop and
mobile without creating real shop bookings. Windows uses installed Microsoft
Edge; elsewhere install Chromium with `pnpm -C apps/web exec playwright install
chromium`. `PLAYWRIGHT_CHANNEL` can select another installed browser.
