# Rosie and Google Calendar

## What Is Implemented

This opt-in bridge keeps Ohana's native booking system and owner workspace.
It does not replace Rosie or change Spencer's phone forwarding. Code-level
hardening is not a live launch approval: Google credentials, Rosie account
configuration and the migration checklist still require owner verification.

- Rosie/manual Google events block customer and owner availability. Google is
  checked again when creating, moving, changing service, or reactivating a visit.
  New or moved time-off blocks also reject overlaps with external busy events.
- Google events appear as read-only entries in the owner schedule, refreshed
  when the day is loaded or refreshed. An outage shows a warning without hiding
  local visits.
- Successful database commits immediately request export of future appointments
  (including buffers) and time off. Rollbacks never request an export. A failed
  network request cannot turn a committed visit into a failed save.
- Scheduled reconciliation recovers after failures, crashes and restarts.
  The committed database is the durable source, including cancelled visits and
  deleted time off; there is no volatile-only queue to lose. The Linux installer
  provisions a recovery timer, running about every 30 seconds when idle.
- Deterministic IDs and persistent aliases prevent duplicates after lost network
  responses and recover Google deleted-event tombstones. Updates use Google's
  ETags when available; unowned event IDs are never overwritten.
- Only events tagged with this installation's private namespace are modified.
  Rosie/manual events are never rewritten or cancelled by the exporter.
- Exports omit customer names, phones, notes and time-off reasons. Google gets
  the service name and occupied interval, with private visibility and no guests.
- Google read failures block new bookings, rather than assuming availability.
  Booking also pauses if the first export has not completed, the last success is
  over two minutes old, the target changed, or a fingerprint of current bookings
  and time off differs from the last exported snapshot. A concurrent database
  change cannot receive a falsely healthy last-success timestamp.
- Detected overlaps between local visits/time off and external Google events
  persist in the database and appear in Shop, with a warning in Schedule. New
  Ohana bookings pause until the overlap is resolved and synchronized. Owners can
  still cancel, delete time off, or move an existing conflicted visit to a free
  slot. Conflict detection does not cancel customers' appointments automatically.
- Transient Google failures receive bounded retries and operation deadlines.
  Persistent failures save sanitized diagnostics and exponential backoff across
  restarts. Manual owner sync can bypass backoff after credentials are fixed.

The existing iCalendar subscription is independent and remains read-only. It is
not this bridge. Avoid showing both feeds in Google if duplicate display entries
are confusing, and ensure Rosie does not count both as separate appointment
sources.

## Important Limits Before Cutover

**This is not an atomic reservation integration. Do not promise zero double
bookings or disable Acuity solely because this bridge exists.**

The recommended production mode is `ROSIE_BOOKING_MODE=link`: configure Rosie
to text the Ohana booking link, so all confirmed visits use Ohana's reservation
logic. This variable records the operating policy; it cannot remotely change
Rosie's settings. Verify the account configuration separately.

For direct Google booking, Rosie and Ohana can both check a free slot before
either writes. Google event creation does not enforce appointment uniqueness.
Post-commit publishing narrows the delay but does not remove the race. Ohana's
database locks protect Ohana bookings, not independent writes by Rosie.
`ROSIE_BOOKING_MODE=calendar` therefore requires
`ROSIE_ACCEPT_NONATOMIC_BOOKINGS=true`; configuration fails closed without this
explicit acknowledgement. Do not enable it by default or as a workaround for a
health warning. Conflict detection is recovery, not prevention.
An Ohana pause cannot stop Rosie from writing to Google. In direct-calendar mode,
pause Rosie's independent booking manually during outages or unresolved conflicts.

Rosie events are busy calendar entries, not Ohana customer appointments. There
is no dependable service/customer schema from Rosie yet: these events do not
automatically create customers, show in `/account`, calculate barber-specific
buffers, or support Ohana cancellation/rescheduling. Manage them through Rosie
or Google. Configure Rosie to occupy the entire service plus buffer, use Pacific
time, and check the exact shared calendar. Verify these capabilities with Rosie
support; the code cannot configure Rosie's account.

Edit Ohana-origin visits in Ohana. Google-side edits to these managed entries are
not imported and will be overwritten by reconciliation. Cancel visits in Ohana;
if a managed Google entry is accidentally deleted, reconciliation recreates it
with a persistent replacement ID instead of silently freeing the local visit.

Before allowing concurrent automated phone and website booking in production,
confirm a shared reservation API is available from Rosie, or explicitly accept
and operationally manage the remaining race. The safe interim configuration is
Rosie texting the Ohana booking link rather than independently confirming times.

## Google Setup

Start with a disposable test calendar, not Spencer's live schedule.

1. In Spencer's Google Calendar account, create a dedicated secondary calendar
   such as "Ohana Bookings" with America/Los_Angeles as its timezone.
2. In Google Cloud, enable Google Calendar API and create a service account.
   Create a private key and store it securely outside the repository.
3. Share the dedicated calendar with the service-account email, granting
   "Make changes to events". Do not use the service account's `primary` calendar.
   Google Workspace sharing restrictions may require an administrator.
4. Configure Rosie, using Spencer's Google login, to use this same calendar for
   both availability checks and booking. Confirm secondary calendars are
   supported by Rosie before proceeding. The service account is only for Ohana.
5. Set server-only environment variables and restart the app:

```dotenv
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CALENDAR_ID=<dedicated calendar ID from Google Calendar settings>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service account email>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<PEM with newlines encoded as \n>"
GOOGLE_CALENDAR_NAMESPACE=<unique random 32-character string>
GOOGLE_CALENDAR_SYNC_SECRET=<separate random 64-character string>
GOOGLE_CALENDAR_AUTO_SYNC=true
ROSIE_BOOKING_MODE=link
ROSIE_ACCEPT_NONATOMIC_BOOKINGS=false
```

Use independent random values for the namespace and secret. Never use
`NEXT_PUBLIC_` variables, paste private keys into chat, or commit credentials.
Keep the namespace stable across deployments; staging and production must use
different calendars and namespaces. Restoring an older database against an
existing live calendar can overwrite newer managed events: review before sync.
A new database refuses to take over a calendar that already contains this
namespace's managed entries without a matching stored binding/last-success
record. Do not bypass this safeguard by copying only KV records into an empty
database. Use a new test calendar/namespace or restore the original full backup.
The production installer generates missing namespace/sync-secret values in the
protected environment file and preserves existing values. Credentials are never
printed. Enabled production integration requires a valid RSA private key of at
least 2048 bits, a sync secret of 32+ characters, and post-commit auto sync.
The service-account email, key and dedicated calendar must still be configured.

## Scheduled Sync

The running app exposes `POST /api/calendar-sync`, authenticated with
`Authorization: Bearer <GOOGLE_CALENDAR_SYNC_SECRET>`. It rejects missing,
incorrect or short configured secrets before initializing the CMS.
Do not put the secret in the URL. Success returns counts, health and last-success
time. Failure or a conflict returns 503; backoff returns 429 with `Retry-After`.
The last successful export is retained on failure.

Authenticated `GET /api/calendar-sync` checks readiness without making Google
requests. It returns 503 for stale, pending, failed or conflicted synchronization.
Use this for external alerting; `/api/health` remains database/process liveness
so an initial calendar outage does not prevent the HTTPS proxy from starting.
Shop polls readiness every 30 seconds and exposes conflicts and retry timing.

The owner can also use Shop -> Rosie & Google Calendar -> Sync Google Calendar
now. This endpoint requires an owner session and the usual mutation Origin.

The Linux installer installs `ohana-calendar-sync.service` and
`ohana-calendar-sync.timer`. The timer invokes the existing app over loopback,
never starting another SQLite writer. It skips while deployment holds its
exclusive lock. Disabled integration exits cleanly without making requests.

For manual deployments, run the following about every 30 seconds, with only one
worker, and alert on nonzero exits (adjust the checkout path):

```sh
docker compose -f /path/to/Ohana-Barbershop/compose.production.yaml exec -T app \
  node scripts/calendar-sync.mjs
```

Store the variables in the existing protected production environment file.
The worker obtains the secret from the container environment, never a literal
argument or URL. It logs only health/counts or generic failures, not Google
responses, credentials or customer details. Run `node scripts/calendar-sync.mjs
--check` for readiness only, or use `pnpm calendar:health` locally. Use one app
instance as required by SQLite. A cold initial bulk export may take multiple
recovery runs; booking remains paused until the full current snapshot succeeds.

Monitor `systemctl status ohana-calendar-sync.timer` and
`journalctl -u ohana-calendar-sync`. Wire failed service runs or the private
readiness endpoint into your monitoring service; journal entries alone do not
send Spencer an alert. Monitoring accounts/destinations are not provisioned.

## Verification and Migration

1. Run the automated tests. They use temporary SQLite databases and mocked Google
   responses; no real Google calls, texts or Rosie conversations are made.
2. On the test calendar, create a Rosie/manual booking. Confirm it displays in
   the owner schedule, blocks website availability and rejects a stale booking.
   Test recurring and all-day events and Pacific daylight-saving transitions.
3. Create an Ohana appointment with a buffer, run sync, and confirm the complete
   occupied interval appears exactly once in Google. Move/cancel/reactivate it.
   Create/edit/delete time off and verify Google follows on the next sync.
4. Confirm Google/manual events are untouched, customer details are absent from
   exports, and an unavailable Google API or stopped scheduler blocks booking.
   Kill/restart the app after a save and verify recovery. Test lost responses,
   cancelled/reactivated visits, accidentally deleted Google entries, and
   overlapping Rosie bookings. Ensure owner-visible conflicts clear only after
   the underlying overlap is resolved and a new sync completes.
5. Verify Rosie checks this calendar and correctly handles every service's
   duration, buffer, hours, lead time, cancellations and reschedules. These settings
   are not synchronized from Ohana into Rosie.
6. Confirm the chosen Rosie mode. In link mode, test a real call that sends the
   correct `/book` URL and does not verbally confirm an unreserved time. Direct
   Google mode requires explicit acceptance of the remaining concurrent-booking
   risk or a verified shared reservation API before a live switch. Keep
   Acuity available while migrating future appointments, checking counts and
   times, and validating the replacement. Do not keep both systems independently
   accepting bookings during cutover.

To disable the bridge, first stop Rosie from independently booking into Google
(or route callers to the Ohana booking link), then set
`GOOGLE_CALENDAR_ENABLED=false` and restart. Disabling does not delete Google
events, but Ohana will no longer block on external calendar events.

## Future Direct Rosie Integration

Ask Rosie support whether it can call authenticated custom availability and
reservation endpoints during a conversation, confirming only after a successful
response. A post-call Zapier "New Booking" trigger cannot reserve a slot before
Rosie confirms it. Direct API support would let both channels use Ohana's
transactional occupancy rules instead of relying on eventual calendar sync.
