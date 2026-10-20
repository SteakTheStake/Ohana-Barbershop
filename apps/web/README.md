# Ohana Website & Owner Studio

Next.js + [Payload CMS](https://github.com/payloadcms/payload) (MIT licensed), with
Ohana's own scheduling and phone-verified customer accounts. No external scheduler
or iframe is used.

From the repository root:

```sh
pnpm install
pnpm setup:local
pnpm dev
```

Use Node 22.16+ or a newer supported Node release. Open http://localhost:3000.
Setup creates `apps/web/.env.local` without overwriting an existing file. Find
the generated owner email/password there; secrets are not committed.
Restart an already-running development server after setup.

- `/owner`: phone/tablet-friendly owner workspace; `/admin` also starts here.
- `/admin/collections/appointments`: optional advanced Payload administration.
- `/book`: service, availability, phone verification, booking, confirmation.
- `/account`: login, history, calendar download, cancellation, rescheduling.

Online booking starts **off**. Review the seeded prices and provisional
30/45-minute durations, add working hours in Ohana Booking Settings, confirm the
cancellation policy, then enable booking. Closed weekdays may be omitted.
Time off blocks breaks/holidays, up to 31 days in one block.
The scheduler currently supports one barber/chair.

Development verification codes appear in the login form; no SMS is sent.
Production requires Twilio Verify and HTTPS. The CMS is free, but hosting and
SMS delivery are not necessarily free.

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm -C apps/web payload generate:types
```

See `../../docs/OHANA_CMS.md` for deployment, migrations, security, backups,
SMS setup, and limitations. Older project plans are historical.
The barber's everyday guide is `../../docs/BARBER_GUIDE.md`.

For Rosie's optional Google Calendar bridge, setup credentials, scheduled sync,
and the remaining concurrent-booking limitations, see
`../../docs/ROSIE_INTEGRATION.md`. The bridge is disabled by default.
Committed visits sync immediately; the Linux installer also provisions scheduled
recovery. Shop shows readiness, retry timing and unresolved calendar conflicts.
`pnpm calendar:health` checks the running app without sending calendar writes.
Browser checks can use `PLAYWRIGHT_PORT=3100` when port 3000 serves an older build;
the test server uses an isolated development cache.

For the Linux production installer, both HTTPS domains, and an explicitly
confirmed database reset, see `../../docs/DEPLOYMENT.md`. From a root-owned
checkout on the Linux server: `sudo bash scripts/setup-production.sh --reset-database`.
