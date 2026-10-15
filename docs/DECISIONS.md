# Ohana Barbershop — Architectural Decision Log

## DEC-001 — Replace Acuity Scheduling with self-hosted Easy!Appointments

**Date:** 2026-10-14 (revised 2026-10-14 — supersedes the earlier "keep Acuity" decision)

**Problem:** The business is moving off Acuity Scheduling and needs a replacement. The preliminary plan proposed a custom booking engine with Supabase, Stripe deposits, and reminders; the previous version of this decision kept the Acuity embed. Both are now off the table: the business wants a **fully open-source** platform it can own outright — effectively a small CMS for services, providers, working hours, customers, and appointments.

**Options:**
1. **Easy!Appointments** (GPL-3.0) — self-hosted appointment scheduler (PHP + MySQL, official Docker Compose setup). Purpose-built for service businesses: services, providers, working plans/breaks, customer records, email notifications, Google Calendar sync, REST API (`openapi.yml` in repo), and an embeddable public booking page.
2. **Cal.diy** (MIT) — community fork of Cal.com. Feature-rich embeds and event types, but heavy stack (Next.js + Postgres, build from source, no official image) and upstream marks it for personal/non-production use. Cal.com itself went closed-source in April 2026.
3. **WordPress + GPL booking plugin** — a literal CMS with scheduling via plugins (Booking Calendar, Amelia free tier), but adds a second PHP stack plus plugin licensing/maintenance for capabilities the site does not otherwise need.
4. Custom booking engine (Supabase + Stripe + Resend/Twilio) — previously rejected; highest build and maintenance cost.
5. Another booking SaaS (Calendly, Square Appointments, etc.) — rejected by the business goal of avoiding proprietary scheduling subscriptions.

**Selected approach:** Option 1 — **Easy!Appointments**, self-hosted via the project's official Docker Compose stack on a small VPS, exposed at a dedicated hostname (e.g., `book.ohana-barbershop.com`). The static website links to and/or iframe-embeds the Easy!Appointments public booking page (`/index.php/booking`) via `NEXT_PUBLIC_BOOKING_URL`.

**Reason:** Easy!Appointments is the only option that is (a) fully open source under GPL-3.0 with no enterprise edition, (b) modeled directly on a service business's needs (services, providers, working hours, customers — the "CMS with scheduling" the business asked for), (c) actively maintained since 2014 with an official Docker image, and (d) API-first enough (REST + OpenAPI spec) to support a future custom booking UI or the Phase 2 mobile app without migrating data again. Booking data lives on infrastructure the business controls instead of a third-party SaaS.

**Consequences:**
- Appointment, customer, service, provider, and availability data is owned by the business in a self-hosted MySQL database — new backup, patching, and uptime responsibilities.
- A small always-on host is required for Easy!Appointments + MySQL (roughly $5–$10/month VPS); the marketing site itself stays a free/cheap static export.
- Email notifications come from Easy!Appointments via SMTP (a transactional provider or Gmail app password must be configured).
- The Easy!Appointments booking wizard does not document a per-service URL parameter; `/book?service=<slug>` preselection must be verified during integration (worst case: wizard always starts at service selection).
- The existing `AcuityEmbed` component and `acuityTypeId` fields become dead code and will be replaced by a `BookingEmbed` component and `bookingServiceId` fields (task BKG-001).
- The website still cannot show live availability inline; that remains possible later via the REST API if desired.
- GPL-3.0 applies to modifications of Easy!Appointments itself; embedding it in the site creates no licensing obligations for our code.

**Status:** Approved — pending implementation (task BKG-001) and owner confirmation of hosting + SMTP.

---

## DEC-002 — Static export instead of server-rendered hosting

**Date:** 2026-10-14

**Problem:** The site has no API routes, no server-side auth, and no dynamic data. Server-rendered hosting is unnecessary.

**Options:**
1. Deploy to Vercel with server-side rendering.
2. Static export to any static host.

**Selected approach:** Option 2 — static export (`output: "export"`) with `images.unoptimized: true`.

**Reason:** Static export is cheaper, portable, and sufficient for a marketing site. It also simplifies rollback and reduces attack surface.

**Consequences:**
- No server-side runtime, API routes, or edge functions.
- Contact form (if added) must use an external form backend or client-side `mailto:` fallback.
- Image optimization is disabled; images must be pre-optimized before deployment.

**Status:** Approved; configuration pending.

---

## DEC-003 — No database or backend in Phase 1

**Date:** 2026-10-14

**Problem:** A backend introduces infrastructure cost, security responsibility, and maintenance overhead.

**Options:**
1. Add Supabase/Postgres backend for services, hours, contact submissions, etc.
2. Store content as static TypeScript data and rebuild on change.

**Selected approach:** Option 2 — static data in `apps/web/src/lib/site.ts`.

**Reason:** The business content changes infrequently. Static data is simpler, free, and avoids database credentials, migrations, and backup concerns.

**Consequences:**
- Content changes require a code edit and redeploy.
- No owner dashboard or CMS in this phase.
- Contact form submissions, if added later, will use a managed form backend rather than a custom database.

**Status:** Approved.

---

## DEC-004 — Defer mobile app to Phase 2

**Date:** 2026-10-14

**Problem:** The preliminary plan included an Expo mobile app with OTP auth, appointments, and push notifications.

**Options:**
1. Build the mobile app in Phase 1 alongside the website.
2. Focus Phase 1 on the website and defer the mobile app.

**Selected approach:** Option 2 — mobile app is out of scope for Phase 1.

**Reason:** The website delivers the core business value (discovery and booking) immediately. A mobile app requires Apple/Google developer accounts, app store review, and ongoing maintenance, which would delay the website launch.

**Consequences:**
- No shared `packages/` logic is needed now.
- The monorepo can still be expanded later without restructure.

**Status:** Approved.

---

## DEC-005 — Keep Tailwind CSS v4

**Date:** 2026-10-14

**Problem:** The repository already uses Tailwind CSS v4 with the new `@theme` and `@import "tailwindcss"` syntax.

**Options:**
1. Downgrade to Tailwind v3 for broader ecosystem compatibility.
2. Keep Tailwind v4 and learn its current patterns.

**Selected approach:** Option 2 — keep Tailwind v4.

**Reason:** The project already builds and lints successfully with v4. Downgrading would require rework with no clear benefit.

**Consequences:**
- Use `@theme` for custom tokens and `@import "tailwindcss"` in CSS.
- Some third-party component libraries may not yet support v4.
- Team must be familiar with v4 conventions.

**Status:** Approved.
