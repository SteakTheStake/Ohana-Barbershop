# Ohana Barbershop - Architecture

> Superseded: the current architecture is Payload CMS + native scheduling.
> See [OHANA_CMS.md](OHANA_CMS.md). The design below is historical.

## Overview

A static, marketing-first website for Ohana Barbershop in Albany, Oregon. The site is built with Next.js 15 (App Router) and TypeScript, styled with Tailwind CSS v4, and exported as static HTML for deployment on a low-cost or free static host. Booking is delegated to a self-hosted **Easy!Appointments** instance (GPL-3.0 open-source scheduler, `docs/DECISIONS.md` DEC-001) running as a separate Docker deployment; the website itself still requires no custom backend database, auth, or booking engine.

## Technology stack

| Layer | Choice | Version (lock file) |
|-------|--------|---------------------|
| Framework | Next.js (App Router) | 15.5.27 |
| Language | TypeScript | ^5 |
| UI library | React | 19.1.0 |
| Styling | Tailwind CSS | ^4 |
| Package manager | pnpm | 12.10.1 |
| Monorepo | pnpm workspaces | — |
| Linting | ESLint 9 + `next/core-web-vitals`, `next/typescript` | ^9 |

## Repository layout

```text
Ohana-Barbershop/
├── apps/web/              # Next.js public website
│   ├── src/app/           # App Router pages
│   ├── src/components/    # Shared React components
│   ├── src/lib/site.ts    # Business info, services, booking helpers
│   ├── public/            # Static assets (logo, icons, banner)
│   └── next.config.ts     # Next.js configuration
├── docs/                  # Engineering documentation
├── package.json           # Root scripts (dev/build/lint)
├── pnpm-workspace.yaml    # Workspace definition
└── (root HTML/CSS files)  # Legacy static prototype; not served by Next.js
```

## Routing

All routes are defined as files under `apps/web/src/app/`:

| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Home page |
| `/services` | `services/page.tsx` | Service menu & prices |
| `/book` | `book/page.tsx` | Booking page with Easy!Appointments embed |
| `/about` | `about/page.tsx` | Owner story |
| `/contact` | `contact/page.tsx` | Contact links & hours |
| `/shop` | `shop/page.tsx` | Merchandise teaser |
| `/sitemap.xml` | `sitemap.ts` | Generated sitemap |

## Data flow

### Customer → Website → Booking

1. Visitor browses static Next.js pages served from the CDN/host.
2. Visitor clicks **Book Now** or a service-specific booking link (`/book?service=<slug>`).
3. The `/book` page embeds the Easy!Appointments public booking wizard (`<NEXT_PUBLIC_BOOKING_URL>/index.php/booking`) in an iframe.
4. Easy!Appointments handles scheduling, availability, email notifications, and optional Google Calendar sync; the owner manages services/providers/hours in the E!A admin backend.
5. The website does not store appointment data — it lives in the self-hosted E!A MySQL database.

### Customer → Contact

1. Visitor navigates to `/contact`.
2. Current implementation displays phone, SMS, email, Instagram, and Facebook links.
3. A contact form may be added in a later task; submissions would be sent to a form backend provider (e.g., Formspree, Netlify Forms, or Resend Contact Forms). No custom server is required.

### Owner → Content updates

1. Content edits (services, prices, hours, contact info) are made in `apps/web/src/lib/site.ts` and page components.
2. The site is rebuilt and redeployed.
3. No CMS or admin dashboard is provided in this phase.

## Integration boundaries

| Capability | Owner | Notes |
|------------|-------|-------|
| Appointments & availability | Easy!Appointments (self-hosted) | Authoritative source for booking; own MySQL DB |
| Booking server hosting | Small VPS (Docker Compose) | TBD provider; e.g. `book.ohana-barbershop.com` |
| Customer contact | Business email / phone | Direct links today; form backend optional |
| Hosting / CDN | Static host (TBD) | Next.js static export |
| Domain / DNS | Existing registrar | `ohana-barbershop.com` |
| Analytics | Optional | Vercel Analytics or similar if host supports it |

## Authentication & authorization

No authentication required for this phase. There is no owner dashboard, customer login, or protected route.

## Error handling

- Next.js default error boundaries are used.
- Build-time TypeScript and ESLint checks must pass before deployment.
- Client-side errors in interactive components (e.g., WebGL greeting/hours logic) must fail gracefully and display a static fallback.

## Environment variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_BOOKING_URL` | Public base URL of the Easy!Appointments instance | No (falls back to placeholder) |

## Hosting & deployment

- Build: `pnpm build` from the repository root runs `next build` in `apps/web`.
- Output: static HTML export configured in `next.config.ts` (to be added).
- Target host: static-capable host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, or existing provider).
- Domain: `ohana-barbershop.com`.

## Reversal / migration difficulty

- Low for the website. The site is a static React frontend; moving hosts requires only rebuilding and uploading the `out/` directory, and the booking embed is an isolated component.
- Medium for booking. Easy!Appointments data lives in our own MySQL, so migrating away means exporting appointment/customer data (DB dump or REST API) — more work than leaving a SaaS, but the business owns the data and cannot be locked out.

## Known limitations

- Booking is fully delegated to Easy!Appointments; the website cannot show real-time availability inline (the E!A REST API could support that later).
- The booking server is a second thing to keep running, patched, and backed up — owned ops burden the Acuity SaaS previously absorbed.
- The E!A booking wizard may not support preselecting a service via URL; `/book?service=<slug>` deep links are pending verification (task BKG-001).
- No server-side validation of contact form submissions (if added) without an external provider.
- No website CMS; marketing content changes require a code edit and redeploy. (Scheduling content — services, hours, staff — is managed in the E!A admin backend.)
