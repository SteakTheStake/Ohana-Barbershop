# Ohana Barbershop — Architectural Decision Log

## DEC-001 — Keep Acuity Scheduling for booking

**Date:** 2026-10-14

**Problem:** The preliminary plan proposed a custom booking engine with Supabase, Stripe deposits, and reminders. This adds cost, complexity, and operational burden for a single-barber shop.

**Options:**
1. Custom booking engine (Supabase + Stripe + Resend/Twilio).
2. Keep the existing Acuity Scheduling embed and defer custom booking.
3. Migrate to Cal.com or another booking SaaS.

**Selected approach:** Option 2 — keep Acuity Scheduling. The website embeds Acuity via iframe and uses appointment-type deep links when configured.

**Reason:** Acuity is already integrated with the existing Squarespace site and the business workflow. Replacing it would consume a significant portion of the $2,000 budget and require ongoing maintenance. The website's job in this phase is to drive traffic to Acuity, not to replicate scheduling logic.

**Consequences:**
- Real-time availability, conflict prevention, reminders, and deposits are handled by Acuity.
- The website cannot show live availability or prevent double bookings.
- Booking data stays in Acuity; no database needed on the website.
- Lower cost, faster delivery, and simpler maintenance.

**Status:** Approved and implemented.

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
