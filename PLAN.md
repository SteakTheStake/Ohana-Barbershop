# Ohana Barbershop - New Website & Mobile App Plan

> Current implementation: Payload CMS + native scheduling + phone verification.
> The external-scheduler/static-only plans below are superseded.
> See `docs/OHANA_CMS.md` for current setup, deployment, and limitations.

> Goal: Replace the current Squarespace site (ohana-barbershop.com) with a modern, fast, custom
> website plus a customer-facing mobile app focused on booking, retention, and merch.
> Brand: island vibez, warm Aloha spirit, traditional barbering, family-friendly ("Ohana" = family).

> **Decision (revised 2026-10-14):** Acuity Scheduling is out. Booking moves to a
> **self-hosted Easy!Appointments** instance (GPL-3.0 open source — a small scheduling
> "CMS" for services, providers, hours, and customers; embedded on `/book` via
> `NEXT_PUBLIC_BOOKING_URL`). The custom booking engine / Supabase / Stripe-deposit
> items below remain superseded. The mobile app can use the Easy!Appointments REST
> API (`openapi.yml` in its repo). See `docs/DECISIONS.md` DEC-001 and task BKG-001.

---

## 1. Goals & Success Criteria

| Goal | Metric |
|------|--------|
| Faster, modern marketing site | Lighthouse ≥ 95, load < 1.5s on 4G |
| Native-feeling online booking (open-source, self-hosted) | Booking completion rate; fewer abandoned bookings |
| Reduce no-shows | Deposit/no-show rate via reminders + cancellation policy |
| Grow repeat business | App accounts, visit history, loyalty perks |
| Own the content | Custom CMS for services, hours, gallery, merch |
| Local discovery | Google Business Profile integration, reviews, local SEO |

## 2. Proposed Stack (recommended)

- **Monorepo:** pnpm + Turborepo
  - `apps/web` — Next.js 15 (App Router) + TypeScript
  - `apps/mobile` — Expo (React Native) — shares booking/types/business logic with web
  - `packages/shared` — types, service catalog, business rules, API client
  - `packages/ui` — design tokens + shared components (where sensible)
- **Styling:** Tailwind CSS + shadcn/ui (web); NativeWind or Tamagui (mobile)
- **Database / Auth:** Supabase (Postgres, Row Level Security, phone/email OTP auth)
- **Payments:** Stripe (cards, Apple/Google Pay) — deposits at booking, merch checkout
- **Booking engine:** Custom (Supabase Postgres + edge functions) — simple for a single barber
  - *Phase 1 choice:* Easy!Appointments (GPL-3.0, self-hosted via Docker) — see `docs/DECISIONS.md` DEC-001
- **CMS:** Sanity (free tier) — services, pricing, hours, gallery, blog/updates
- **Notifications:** Resend (email) + Twilio (SMS) — booking confirmations, reminders (24h/2h)
- **Hosting:** Vercel (web/API), Supabase (DB), EAS (mobile builds)
- **Analytics:** Vercel Analytics + PostHog (lightweight)

## 3. Pages & Features — Website

| Route | Contents |
|-------|----------|
| `/` | Hero (photo/video of shop + "Book now"), service highlights, gallery, testimonials, hours/map, IG feed, CTA |
| `/services` | Service menu with prices (Keiki Kutz $25, Buzz/Senior $25, Haircut $35, Skin Fade $40, Beard Trim $20), duration, "Book" per service |
| `/book` | Multi-step booking: service → date/time (real-time availability) → name/phone → deposit (Stripe) → confirmation |
| `/about` | Spencer's story (Hauula → Albany), shop photos, "meet your barber" |
| `/shop` | Merch (initially "coming soon" teaser with email signup), Stripe checkout when launched |
| `/contact` | Phone (458-309-8765), email, form, map, hours, socials (IG: @ohana_barber541, FB) |
| `/gallery` | Real haircut photos fed from Instagram + admin uploads |
| SEO | Metadata per page, OG images, JSON-LD (LocalBusiness, BarberShop schema), sitemap, Google Business Profile links |

### Core booking flow (custom engine)

1. Services stored in DB with `duration_minutes` and `price_cents`
2. Availability: weekly schedule + time-off blocks; slots computed as `open − booked − buffer`
3. Booking states: `pending_payment → confirmed → completed / no_show / cancelled`
4. Deposit (e.g., $10 or % of service) captured via Stripe; refundable up to 24h before
5. Reminders: email + SMS at 24h and 2h before appointment
6. Admin view: Spencer sees today's schedule, can block time, mark no-shows

## 4. Mobile App (Phase 2 — Expo)

Customer-facing, booking-centric:

- **Onboarding:** phone number OTP login (Supabase)
- **Home:** next appointment card, "Book again" one-tap repeat of last service
- **Booking:** same flow as web (shared `packages/shared` logic)
- **Appointments:** upcoming/past, cancel/reschedule (policy-aware), add to calendar
- **Profile:** name, preferences (clipper guard, style notes), payment methods (Stripe)
- **Loyalty (stretch):** punch-card "10th cut free" tracked server-side
- **Shop (stretch):** browse merch, Apple/Google Pay checkout
- **Notifications:** push via Expo Notifications (booking reminders, promos)
- Released to App Store + Google Play (EAS build/submit)

## 5. Design Direction

- **Mood:** tropical/island meets clean barbering — warm sand, deep ocean teal, palm/hibiscus accents, palm-frond or barber-pole motifs
- **Typography:** bold display face (e.g., Bricolage Grotesque / Clifton) + clean body (Inter/Geist)
- **Imagery:** real shop/barber photos; hero video loop if possible; the existing OG logo artwork as the base identity
- **Motion:** subtle scroll reveals, smooth page transitions; keep it fast (no heavy libs — CSS/Framer Motion)
- Mobile-first; accessible (WCAG AA); dark "shop interior" section accents

## 6. Data Model (initial)

```
services(id, name, description, duration_minutes, price_cents, active, sort)
business_hours(day_of_week, opens_at, closes_at, closed)
time_off(id, starts_at, ends_at, reason)
appointments(id, service_id, customer_id, starts_at, ends_at, status, deposit_payment_id)
customers(id, phone, email, name, notes, preferences)
payments(id, appointment_id, stripe_id, amount_cents, status, kind)  -- deposit|merch|full
products(id, name, description, price_cents, images, active)        -- merch
reviews(id, author, rating, source, body, approved)
```

## 7. Phases & Milestones

### Phase 0 — Discovery (before any code)
- [ ] Confirm with Spencer: street address, business hours, deposit/no-show policy, booking lead time, whether multiple barbers (future-proof the schema anyway)
- [ ] Collect photo/video assets (shop interior, Spencer at work, haircut examples)
- [ ] Register: Stripe account, Google Business Profile access, domain DNS control, Apple/Google dev accounts (for the app)
- [ ] Decide merch timeline (Shop "coming soon" vs. launch)

### Phase 1 — Website MVP
- [ ] Monorepo scaffold (Turborepo, Next.js, Tailwind, shadcn/ui)
- [ ] Design system: tokens, layout, components, hero concept
- [ ] Marketing pages: Home, Services, About, Contact (+ SEO/JSON-LD, OG)
- [ ] Supabase schema + seed with scraped service catalog & hours
- [ ] Booking engine: availability computation + booking CRUD + admin schedule view
- [ ] Stripe deposits + booking confirmation emails (Resend)
- [ ] SMS reminders (Twilio) + email reminders
- [ ] Gallery + testimonials, IG integration
- [ ] Lighthouse/SEO pass, analytics, deploy to Vercel, point domain

### Phase 2 — Mobile App
- [ ] Expo app scaffold, phone OTP auth (Supabase)
- [ ] Booking flow (shared logic from `packages/shared`)
- [ ] Appointments list/profile/preferences, calendar integration
- [ ] Push notifications (Expo) wired to reminder events
- [ ] Store assets (icons, screenshots), EAS build, TestFlight/internal testing
- [ ] App Store + Google Play submission

### Phase 3 — Enhancements
- [ ] Merch/e-commerce launch (products, Stripe checkout, fulfillment notes)
- [ ] Loyalty punch card + referral codes
- [ ] Admin dashboard for Spencer (day view, customer notes, analytics)
- [ ] Waitlist for popular slots
- [ ] Blog/updates via CMS (e.g., style tips, shop news)

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Action |
|-----------------|---------------------|
| Custom booking adds ops burden for a solo barber | Phase 1 uses Easy!Appointments instead — admin UI is already built; keep it dead-simple and defer any custom engine |
| No address/hours published today | Must collect in Phase 0 — blocks schema + SEO JSON-LD |
| Deposits may deter walk-in culture | Make deposits optional/configurable; policy decided in Phase 0 |
| App store review timelines | Submit web first; app is Phase 2 so site value ships early |
| IG feed API restrictions | Fallback: admin-managed gallery uploads via CMS |
| Merch not ready | Ship Shop as "coming soon" + email capture, matching current intent |
