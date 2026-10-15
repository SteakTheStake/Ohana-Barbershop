# OHANA BARBERSHOP
# ENGINEERING BLUEPRINT & AGENT EXECUTION PROTOCOL

**Priority:** CRITICAL  
**Applies to:** Repository analysis, planning, implementation, testing, visual design, security, and deployment.

## YOUR ROLE

You are an experienced senior full-stack engineer, software architect, UI/UX designer, accessibility specialist, QA engineer, and technical instructor.

You are responsible for planning and implementing a premium-quality website for Ohana Barbershop, a family-owned barbershop in Albany, Oregon.

You must translate high-level business requirements into small, explicit, independently verifiable engineering tasks.

Assume the coding agent that executes your plan has limited reasoning ability, limited context capacity, and a tendency to make mistakes when instructions are ambiguous.

**Your plan must compensate for those limitations.**

A successful plan allows a new coding agent with no memory of previous conversations to open the repository, read `docs/IMPLEMENTATION_PLAN.md`, identify the next task, implement it correctly, verify it, and continue without inventing requirements or architecture.

Your objective is to maximize:

1. Implementation correctness.
2. Visual quality.
3. Customer experience.
4. Security and reliability.
5. Code maintainability.
6. Development efficiency.
7. Agent context efficiency.
8. Test coverage.
9. Predictability.
10. Long-term operational simplicity.

The deliverable is a beautiful, functional, production-quality small-business website—not merely a collection of technically complete features.

---

# CURRENT EXECUTION STATE

- Current phase: PHASE 2 — Public page polish.
- Current task ID: PERF-001.
- Task status: BLOCKED — image/font optimizations and OceanText animation lifecycle fix implemented. Home Performance/LCP and booking Best Practices still fail the overall gate.
- Last successful verification: 2026-10-14 — `node --test apps/web/src/components/ocean-text.test.mjs` (5 tests), `pnpm build`, `pnpm lint`, image/HTTP assertions, font-preload checks, and `git diff --check` pass. Fresh home screenshots at 375/390/768/1024/1440px show unchanged design and no horizontal overflow. Three-run mobile Lighthouse medians using verified local gzip delivery: Home 82 / LCP 2.65s (FAIL); Services/About/Contact/Shop 98 / LCP 2.35–2.36s (PASS); Book 97 / LCP 2.42s (PASS Performance/LCP), Best Practices 77 (FAIL). Accessibility 96–100 and SEO 100 pass. These are local compressed-delivery lab results, not deployed-host verification.
- Known blockers: Home's remaining main-thread work (median TBT 578ms) and LCP 2.65s need investigation; the loop fix is a verified correctness improvement but did not measurably improve the score. `/book`'s Acuity cookies still cause Best Practices 77; provider cutover belongs to BKG-001. Controlled same-build raw/gzip comparison confirms that uncompressed serving materially inflated prior LCP results. Actual production compression/cache headers remain unverified; no deployment changes were made. BKG-001 needs owner VPS/DNS/SMTP decisions; HRS-001, GAL-001, FRM-001 remain blocked. Font preloads and animation-loop accumulation are RESOLVED.
- Files relevant to current task: `apps/web/src/components/ocean-text.tsx`, `apps/web/src/components/ocean-text.test.mjs`, `docs/TEST_PLAN.md`. Reports: `C:/Users/gabec/AppData/Local/Temp/vqa/delivery-before-{raw,gzip}-{home,services}-{1,2,3}.json`, `scheduling-gzip-<page>-<run>.json`, `delivery-summary.json`, and `scheduling-summary.json`.
- Next required action: Continue PERF-001's home main-thread/LCP investigation under controlled compressed delivery and resolve the booking-provider Best Practices blocker when BKG-001 can proceed. Verify actual host compression at deployment. Do not mark COMPLETE or begin DEP-001 in this execution.

---

# PROJECT-SPECIFIC PLAN

## Project mission

Replace the existing Squarespace site for Ohana Barbershop with a fast, modern, custom static website that reflects the shop's island brand, showcases services and prices, tells the owner's story, and drives online bookings through a self-hosted, open-source Easy!Appointments instance.

## Business requirements

1. Present a welcoming, professional, mobile-first marketing site.
2. Display accurate services, prices, and business contact information.
3. Enable online booking via Easy!Appointments (self-hosted, open source — see `docs/DECISIONS.md` DEC-001).
4. Improve local SEO with metadata, sitemap, JSON-LD, and a canonical domain.
5. Provide clear contact channels (phone, text, email, social).
6. Support future expansion (gallery, merchandise, dashboard) without re-architecture.

## Approved scope and exclusions

In scope for this phase:
- Home, Services, About, Contact, Shop, and Book pages.
- Responsive navigation, footer, and mobile book bar.
- Easy!Appointments booking wizard embed on `/book` (per-service deep links pending verification).
- SEO metadata, Open Graph, JSON-LD, and sitemap.
- Static export and deployment to a low-cost static host.
- Accessibility and performance improvements.
- Visual polish and brand consistency.

Out of scope:
- Custom booking engine or database.
- Customer accounts or authentication.
- Owner dashboard or CMS.
- Mobile app.
- E-commerce checkout (Shop remains a "coming soon" teaser).
- Chatbot.
- Missed-call integration.
- Automated SMS/email reminders.

## Existing repository audit

- **Framework:** Next.js 15.5.27 App Router with React 19.1.0 and TypeScript 5.
- **Styling:** Tailwind CSS v4 with custom `@theme` tokens.
- **Package manager:** pnpm workspaces (root + `apps/web`).
- **Build status:** `pnpm build` succeeds; `pnpm lint` succeeds.
- **Routes implemented:** `/`, `/services`, `/book`, `/about`, `/contact`, `/shop`, `/sitemap.xml`.
- **Booking:** Acuity embed via `AcuityEmbed` component still present in code; scheduled for replacement by an Easy!Appointments embed in task BKG-001 (`acuityTypeId` → `bookingServiceId`).
- **Design tokens:** Colors, typography, and patterns are defined in `globals.css`.
- **Static assets:** Logo, SVG icons, banner image in `apps/web/public/`.
- **Legacy files:** Root `*.html` and `style.css` are the old static prototype and are not served by Next.js.
- **Tests:** No automated test suite currently configured.
- **Docs:** All required documentation files exist but were empty before this audit.

## Selected architecture and justifications

- **Next.js 15 App Router + TypeScript:** Already in use; mature, SEO-friendly, builds to static export.
- **Tailwind CSS v4:** Already in use; tokens match the brand and build passes.
- **Static export:** No backend is needed for a marketing site; keeps hosting cheap and portable.
- **Easy!Appointments (self-hosted):** Open-source (GPL-3.0) scheduler built for service businesses; replaces Acuity so the business owns its booking data. Runs as a separate Docker deployment; website integrates via iframe/link only.
- **No database / auth / CMS:** Content changes are infrequent; static data keeps the stack simple.

See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` for full details.

## Documentation index

| Document | Purpose |
|----------|---------|
| `docs/IMPLEMENTATION_PLAN.md` | Master plan, current status, and atomic tasks (this file) |
| `docs/PROGRESS.md` | Task status and execution log |
| `docs/ARCHITECTURE.md` | Technology stack, data flow, hosting |
| `docs/DESIGN_SYSTEM.md` | Tokens, components, page compositions, responsive rules |
| `docs/DATA_MODEL.md` | Static data contracts and future entity reference |
| `docs/INTEGRATIONS.md` | External service specifications and blockers |
| `docs/TEST_PLAN.md` | Manual and automated test matrix |
| `docs/DEPLOYMENT.md` | Build, host, domain, rollback procedures |
| `docs/DECISIONS.md` | Architectural decision log |

## Functional requirements

### Public website

| Page | Required content | CTA |
|------|------------------|-----|
| Home | Hero, greeting, service preview, feature grid, closing CTA | Book Now, Prices |
| Services | Full service menu with prices | Book Now, per-service booking |
| About | Owner story, key facts, decorative icon | Book Now |
| Contact | Phone, text, email, Instagram, hours, location | Call, Text, Email |
| Shop | Merchandise teaser | Follow Instagram |
| Book | Easy!Appointments embed, fallback contact | Call if trouble |

### Booking

- `/book` displays the Easy!Appointments booking wizard iframe (`<NEXT_PUBLIC_BOOKING_URL>/index.php/booking`).
- `/book?service=<slug>` preselects the matching service **if** the E!A wizard supports a deep-link parameter — verify during BKG-001; otherwise the wizard always opens at service selection.
- If the booking server fails to load, show fallback contact message.

### SEO

- Unique page titles and meta descriptions.
- Open Graph image and site name.
- JSON-LD `BarberShop` schema on every page (via root layout).
- `sitemap.xml` with all public routes.
- Canonical URLs.

## Nonfunctional requirements

| Category | Requirement |
|----------|-------------|
| Performance | Lighthouse Performance ≥ 90; LCP < 2.5s. |
| Accessibility | WCAG 2.2 AA; keyboard navigation; reduced-motion support; sufficient contrast. |
| SEO | Lighthouse SEO ≥ 95; valid sitemap and JSON-LD. |
| Responsive | Verified at 375px, 390px, 768px, 1024px, 1440px. |
| Browser support | Latest 2 versions of Chrome, Firefox, Safari, Edge. |
| Security | No secrets in repository; no server-side attack surface. |
| Maintainability | Small components; documented design tokens; no unnecessary dependencies. |

## Feature dependencies

```text
CFG-001 Configure static export
    ├── SEO-001 Page metadata
    ├── VIS-001 Home visual QA
    ├── VIS-002 Services visual QA
    ├── BKG-001 Replace Acuity embed with Easy!Appointments (BLOCKED — needs VPS + SMTP)
    │       └── VIS-003 Book page & booking fallback
    ├── VIS-004 About visual QA
    ├── VIS-005 Contact visual QA
    ├── VIS-006 Shop visual QA
    ├── A11Y-001 Accessibility audit
    ├── PERF-001 Performance & Lighthouse
    └── DEP-001 Production deployment

HRS-001 Business hours (BLOCKED — owner confirmation)
    └── Updates VIS-005 / Contact page

GAL-001 Gallery page (BLOCKED — photo assets)
    └── Adds new route

FRM-001 Contact form backend (BLOCKED — provider selection)
    └── Replaces/enhances VIS-005

Note: VIS-003 verifies the booking embed; run it after BKG-001 if the
Easy!Appointments instance is ready, otherwise against the placeholder URL.
```

## Development phases

### PHASE 0 — Discovery and specification (current)

Audit repository, document architecture, design system, data model, integrations, test plan, deployment, and decisions. Create atomic implementation tasks. **Do not implement features yet.**

### PHASE 1 — Foundation

Configure static export, build pipeline, and hosting prerequisites.

### PHASE 2 — Public page polish

SEO metadata, visual QA, accessibility fixes, and responsive refinement across all pages.

### PHASE 3 — Optional content (if blockers resolved)

Add business hours, gallery, and/or contact form once owner confirmation and assets are available.

### PHASE 4 — Performance & deployment

Lighthouse optimization, final visual review, production deployment, and post-deployment verification.

## Atomic implementation tasks

### PLAN-001 — Audit repository and create implementation plan

**Objective:** Produce a complete, self-contained engineering plan that allows the next agent to begin implementation without ambiguity.

**Priority:** Critical.

**Status:** COMPLETE.

**Dependencies:** None.

**Files to inspect:** `docs/IMPLEMENTATION_PLAN.md`, `docs/PROGRESS.md`, `PLAN.md`, `scraped/site-content.md`, `apps/web/**/*`, root `*.html`.

**Files to modify or create:**
- `docs/ARCHITECTURE.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/DATA_MODEL.md`
- `docs/INTEGRATIONS.md`
- `docs/TEST_PLAN.md`
- `docs/DEPLOYMENT.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PROGRESS.md`

**Required implementation:**
1. Inspect repository structure, dependencies, and build output.
2. Record technology stack, existing pages, components, and design tokens.
3. Document architecture, data model, integrations, test plan, deployment, and key decisions.
4. Define approved scope and explicit exclusions.
5. Create atomic, dependency-ordered implementation tasks.
6. Update `CURRENT EXECUTION STATE`.
7. Update `PROGRESS.md`.

**Acceptance criteria:**
- [ ] All required docs exist and are non-empty.
- [ ] `pnpm build` and `pnpm lint` still pass.
- [ ] Atomic tasks have stable IDs, dependencies, acceptance criteria, and verification steps.
- [ ] Current execution state is updated.
- [ ] Next executable task is identified.

**Verification:**
- `pnpm build`
- `pnpm lint`
- Read `docs/IMPLEMENTATION_PLAN.md` and confirm `CURRENT EXECUTION STATE` and next task are present.

**Expected result:** Build and lint pass; plan is ready for implementation.

**Completion evidence:** Build output, lint output, updated docs.

**Regression considerations:** No source code changes except documentation.

**Rollback:** Revert documentation commits.

**Next task:** CFG-001.

---

### CFG-001 — Configure static export and production build

**Objective:** Configure Next.js for static export so the site can be deployed to any static host.

**Priority:** Critical.

**Status:** COMPLETE.

**Dependencies:** PLAN-001.

**Files to inspect:** `apps/web/next.config.ts`, `apps/web/package.json`, `apps/web/src/app/layout.tsx`.

**Files to modify or create:** `apps/web/next.config.ts`.

**Required implementation:**
1. Set `output: "export"` in `next.config.ts`.
2. Set `distDir: "dist"` (or keep default `out` if preferred).
3. Set `images: { unoptimized: true }` because static export cannot use the Next.js image server.
4. Verify `pnpm build` produces the expected static files.
5. Verify all routes are present in the output.

**Acceptance criteria:**
- [ ] `pnpm build` passes.
- [ ] Static files are generated for `/`, `/services`, `/book`, `/about`, `/contact`, `/shop`, `/sitemap.xml`.
- [ ] `404.html` is generated.
- [ ] No build warnings about image optimization or `output: "export"` conflicts.

**Verification:**
- `pnpm build`
- `ls apps/web/dist/` (or `apps/web/out/`)

**Expected result:** Clean build with static HTML files.

**Completion evidence:** Build output listing all routes.

**Regression considerations:** No visual changes; ensure image rendering still works.

**Rollback:** Revert `next.config.ts`.

**Next task:** SEO-001.

---

### SEO-001 — Add page-specific metadata and descriptions

**Objective:** Ensure every page has a unique, descriptive title and meta description.

**Priority:** High.

**Status:** COMPLETE.

**Dependencies:** CFG-001.

**Files to inspect:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/*/page.tsx`, `apps/web/src/lib/site.ts`.

**Files to modify or create:** `apps/web/src/app/*/page.tsx` metadata exports.

**Required implementation:**
1. Add `description` and `openGraph` metadata to each page export.
2. Use the site name template for titles where appropriate.
3. Keep titles concise (< 60 characters) and descriptions < 160 characters.

**Acceptance criteria:**
- [ ] Every public page has a unique `<title>` and `<meta name="description">`.
- [ ] Open Graph `title`, `description`, and `image` are present on each page.
- [ ] Build passes with no metadata warnings.

**Verification:**
- `pnpm build`
- Inspect `<head>` of each generated page.

**Expected result:** Rich metadata on all pages.

**Completion evidence:** Build output and head inspection.

**Regression considerations:** No layout regressions.

**Rollback:** Revert metadata changes.

**Next task:** VIS-001.

---

### VIS-001 — Home page visual QA and responsive fixes

**Objective:** Ensure the home page looks polished and functions correctly at all target viewports.

**Priority:** High.

**Status:** COMPLETE (2026-10-14).

**Dependencies:** CFG-001.

**Files to inspect:** `apps/web/src/app/page.tsx`, `apps/web/src/components/ocean-text.tsx`, `apps/web/src/components/greeting.tsx`, `apps/web/src/app/globals.css`.

**Files to modify or create:** `apps/web/src/app/page.tsx` (and related components if defects found).

**Required implementation:**
1. Verify hero layout at 375px, 390px, 768px, 1024px, 1440px.
2. Confirm `OceanText` WebGL fallback works if WebGL is unavailable.
3. Confirm shimmer animation respects `prefers-reduced-motion`.
4. Fix any clipping, overlap, or spacing defects.
5. Ensure CTA buttons are tappable on mobile.

**Acceptance criteria:**
- [x] No horizontal scroll at any viewport.
- [x] Hero logo is not stretched.
- [x] Text remains legible.
- [x] CTA buttons are prominent and reachable.
- [x] Reduced-motion mode disables animations.

**Verification:**
- `pnpm build && pnpm start` or `pnpm dev`
- Manual browser inspection at 375px, 390px, 768px, 1024px, 1440px.

**Expected result:** Home page passes visual quality rules.

**Completion evidence:** Screenshots at each viewport.

**Regression considerations:** Header, footer, and service list must remain functional.

**Rollback:** Revert page changes.

**Next task:** VIS-002.

---

### VIS-002 — Services page visual QA

**Objective:** Ensure the services page is clear, readable, and easy to book from.

**Priority:** High.

**Status:** COMPLETE (2026-10-14).

**Dependencies:** VIS-001.

**Files to inspect:** `apps/web/src/app/services/page.tsx`, `apps/web/src/components/service-list.tsx`.

**Files to modify or create:** Same files if defects found.

**Required implementation:**
1. Verify service list spacing and price alignment.
2. Confirm each row links to the correct `/book?service=<slug>` URL.
3. Ensure the "Book →" hover hint does not obscure content.
4. Test at all target viewports.

**Acceptance criteria:**
- [x] All services display correctly.
- [x] Prices are aligned and readable.
- [x] Row hover/focus states are visible.
- [x] Mobile tap targets are ≥ 44px tall.

**Verification:**
- `pnpm dev`
- Manual inspection and tap/click tests.

**Expected result:** Services page is visually complete and usable.

**Completion evidence:** Screenshots and link verification.

**Regression considerations:** Links must still route correctly.

**Rollback:** Revert page/component changes.

**Next task:** BKG-001 (if unblocked) or VIS-003.

---

### BKG-001 — Replace Acuity embed with Easy!Appointments

**Objective:** Migrate booking from Acuity Scheduling to a self-hosted, open-source Easy!Appointments instance per DEC-001.

**Priority:** High (required before production launch).

**Status:** BLOCKED — needs a VPS for the booking server and an SMTP provider decision from the owner.

**Dependencies:** VIS-002 (independent technically; sequenced here to avoid blocking page QA). External: VPS + DNS hostname for the booking server; SMTP credentials.

**Files to inspect:** `apps/web/src/components/acuity-embed.tsx`, `apps/web/src/app/book/book-client.tsx`, `apps/web/src/app/book/page.tsx`, `apps/web/src/lib/site.ts`, `docs/INTEGRATIONS.md` section 1, `docs/DEPLOYMENT.md` "Booking server".

**Files to modify or create:**
- `apps/web/src/components/acuity-embed.tsx` → rename/rewrite as `booking-embed.tsx` (iframe → `<NEXT_PUBLIC_BOOKING_URL>/index.php/booking`, lazy load, `onError`/timeout fallback).
- `apps/web/src/lib/site.ts` — rename `acuityTypeId` → `bookingServiceId`; populate with E!A service IDs once services are created in the admin backend.
- `apps/web/src/app/book/book-client.tsx`, `apps/web/src/app/book/page.tsx`, `apps/web/src/app/page.tsx` — update imports and Acuity copy ("24/7 via Acuity" → generic booking copy).

**Required implementation:**
1. Provision a small VPS (~$5–$10/mo) and deploy the official Easy!Appointments Docker Compose stack (app + MySQL).
2. Run the E!A web installer; set timezone `America/Los_Angeles`, business info, and the working plan.
3. Create the owner as a provider; create the five services to mirror `site.ts` (Haircut $35, Skin Fade $40, Buzz/Senior $25, Keiki Kutz $25, Beard Trim $20) and record their service IDs.
4. Configure SMTP in E!A settings; send a test booking and confirm the notification email.
5. Point a hostname (e.g., `book.ohana-barbershop.com`) at the VPS with HTTPS.
6. Rewrite the website embed: iframe the E!A booking page via `NEXT_PUBLIC_BOOKING_URL`; verify whether the wizard honors a service preselect parameter (check `openapi.yml` / E!A docs); wire `bookingServiceId` if supported, otherwise drop preselection.
7. Schedule nightly `mysqldump` backups of the E!A database (copy off-host).
8. Remove the Acuity embed script (`https://embed.acuityscheduling.com/js/embed.js`) and placeholder env var.

**Acceptance criteria:**
- [ ] `/book` loads the E!A booking wizard in an iframe without horizontal scroll.
- [ ] A test appointment booked through the wizard appears in the E!A admin calendar and triggers an email.
- [ ] Fallback contact text shows if the booking server is unreachable.
- [ ] No Acuity URLs, scripts, or `acuityTypeId` references remain in `apps/web`.
- [ ] `NEXT_PUBLIC_BOOKING_URL` documented; placeholder fallback preserved for local dev.
- [ ] DB backup job verified on the VPS.

**Verification:**
- `pnpm build && pnpm lint` pass.
- Manual booking smoke test end-to-end on staging/production hostname.
- `grep -ri acuity apps/web/src` returns no matches.

**Expected result:** Fully open-source, self-hosted booking replaces Acuity; site booking UX unchanged or better.

**Completion evidence:** E!A admin screenshot, test appointment confirmation email, grep output.

**Regression considerations:** Per-service preselection may be lost if E!A does not support it — document the outcome in `docs/INTEGRATIONS.md`. `book.html`/`index.html` legacy prototype still references Acuity but is not served; leave or clean separately.

**Rollback:** Keep `NEXT_PUBLIC_BOOKING_URL` pointing at the placeholder until cutover; revert embed component changes if needed.

**Next task:** VIS-003.

---

### VIS-003 — Book page visual QA and booking fallback

**Objective:** Ensure the booking page presents the scheduling embed cleanly and degrades gracefully.

**Priority:** High.

**Status:** COMPLETE (2026-10-14 — verified against the Acuity placeholder; re-verify at BKG-001 cutover).

**Dependencies:** VIS-002; BKG-001 if the Easy!Appointments instance is available (otherwise verify against the placeholder and re-verify at cutover).

**Files to inspect:** `apps/web/src/app/book/page.tsx`, `apps/web/src/components/acuity-embed.tsx` (or `booking-embed.tsx` after BKG-001), `apps/web/src/lib/site.ts`.

**Files to modify or create:** Same files if defects found.

**Required implementation:**
1. Verify iframe height is appropriate for the booking wizard content.
2. Add a client-side fallback message if the iframe fails to load (e.g., timeout or `onError`).
3. Confirm `/book?service=<slug>` updates the page title and preselects the service when E!A deep linking is supported.
4. Test at all target viewports.

**Acceptance criteria:**
- [x] Iframe loads without horizontal scroll.
- [x] Fallback contact text is visible if the booking server fails.
- [x] Page title reflects selected service.
- [x] Mobile layout does not break.

**Verification:**
- `pnpm dev`
- Load `/book` and `/book?service=haircut`.
- Simulate iframe failure (e.g., block network request) and confirm fallback.

**Expected result:** Booking page is robust and visually polished.

**Completion evidence:** Screenshots and fallback test notes.

**Regression considerations:** Booking links from Services page must still work.

**Rollback:** Revert component/page changes.

**Next task:** VIS-004.

---

### VIS-004 — About page visual QA

**Objective:** Ensure the about page tells the owner story clearly and looks polished.

**Priority:** Medium.

**Status:** COMPLETE (2026-10-14 — no defects found; no code changes required).

**Dependencies:** VIS-003.

**Files to inspect:** `apps/web/src/app/about/page.tsx`.

**Files to modify or create:** Same file if defects found.

**Required implementation:**
1. Verify fact list readability and alignment.
2. Ensure decorative icon does not overlap text.
3. Test at all target viewports.

**Acceptance criteria:**
- [x] Content is readable and well-paced.
- [x] No overlapping elements.
- [x] CTA button is visible.

**Verification:**
- `pnpm dev` + manual inspection.

**Expected result:** About page passes visual quality rules.

**Completion evidence:** Screenshots.

**Regression considerations:** None.

**Rollback:** Revert page changes.

**Next task:** VIS-005.

---

### VIS-005 — Contact page visual QA

**Objective:** Ensure the contact page makes it easy to reach the shop.

**Priority:** High.

**Status:** COMPLETE (2026-10-14 — no defects found; no code changes required).

**Dependencies:** VIS-004.

**Files to inspect:** `apps/web/src/app/contact/page.tsx`, `apps/web/src/lib/site.ts`.

**Files to modify or create:** Same files if defects found.

**Required implementation:**
1. Verify contact action cards are easy to tap/click.
2. Confirm phone, SMS, email, Instagram, and Facebook links use correct URLs.
3. Ensure hours/location card displays correctly when `site.hours` is populated.
4. Test at all target viewports.

**Acceptance criteria:**
- [x] All contact links work.
- [x] Cards are readable and well-aligned.
- [x] Tap targets are large enough on mobile.
- [x] Hours display correctly when available.

**Verification:**
- `pnpm dev`
- Click each contact link.
- Temporarily populate `site.hours` and verify rendering.

**Expected result:** Contact page is functional and visually complete.

**Completion evidence:** Screenshots and link check results.

**Regression considerations:** `site` data changes must be reverted if temporary.

**Rollback:** Revert page changes.

**Next task:** VIS-006.

---

### VIS-006 — Shop page visual QA

**Objective:** Ensure the merchandise teaser page is on-brand and links to Instagram.

**Priority:** Low.

**Status:** COMPLETE (2026-10-14 — no defects found; no code changes required).

**Dependencies:** VIS-005.

**Files to inspect:** `apps/web/src/app/shop/page.tsx`.

**Files to modify or create:** Same file if defects found.

**Required implementation:**
1. Verify typography hierarchy.
2. Confirm Instagram link opens in a new tab.
3. Test at all target viewports.

**Acceptance criteria:**
- [x] Teaser card is centered and visually balanced.
- [x] Link is reachable and opens Instagram.
- [x] No layout issues on mobile.

**Verification:**
- `pnpm dev` + manual inspection.

**Expected result:** Shop page is visually complete.

**Completion evidence:** Screenshot.

**Regression considerations:** None.

**Rollback:** Revert page changes.

**Next task:** A11Y-001.

---

### A11Y-001 — Accessibility audit and fixes

**Objective:** Bring the site to WCAG 2.2 AA compliance.

**Priority:** High.

**Status:** COMPLETE (2026-10-14).

**Dependencies:** VIS-001 through VIS-006.

**Files to inspect:** All page and component files.

**Files to modify or create:** Relevant component/page files.

**Required implementation:**
1. Verify keyboard navigation on every interactive element.
2. Add or improve focus indicators where needed.
3. Check heading hierarchy (`h1` → `h2` → `h3`).
4. Verify all images have appropriate `alt` text; decorative elements use `aria-hidden`.
5. Confirm color contrast meets AA.
6. Verify form labels if a contact form is added.
7. Test reduced-motion preference.

**Acceptance criteria:**
- [x] All interactive elements are keyboard accessible.
- [x] Focus is visible.
- [x] Heading hierarchy is logical.
- [x] Images have descriptive `alt` or are hidden from AT.
- [x] Color contrast passes AA for normal and large text.
- [x] Animations respect `prefers-reduced-motion`.

**Verification:**
- Keyboard-only navigation test.
- Browser dev tools contrast audit.
- `prefers-reduced-motion` simulation.

**Expected result:** Site meets WCAG 2.2 AA.

**Completion evidence:** Audit notes and screenshots of focus states.

**Regression considerations:** Visual appearance may change slightly (focus rings).

**Rollback:** Revert accessibility changes.

**Next task:** PERF-001.

---

### PERF-001 — Performance optimization and Lighthouse audit

**Objective:** Achieve strong Lighthouse scores across all pages.

**Priority:** High.

**Status:** BLOCKED (2026-10-14 — image/font optimization and animation lifecycle fixes implemented. Compressed-delivery medians pass Performance/LCP on five pages; Home still fails and `/book` Best Practices remains blocked by Acuity cookies. No production-host verification yet).

**Dependencies:** A11Y-001.

**Files to inspect:** All page files, `apps/web/src/app/layout.tsx`, public assets.

**Files to modify or create:** Relevant files for optimizations.

**Required implementation:**
1. Audit each page with Lighthouse.
2. Optimize images (WebP, correct sizing, lazy loading where appropriate).
3. Ensure hero logo and critical assets are prioritized.
4. Minimize render-blocking resources.
5. Verify `next/font` preloading.

**Acceptance criteria:**
- [ ] Lighthouse Performance ≥ 90. Latest three-run gzip-delivery medians: five pages 97–98 (pass); Home 82 (fail). Local lab results, not production-host verification.
- [x] Lighthouse Accessibility ≥ 90. Measured 96–100 across all six pages.
- [ ] Lighthouse Best Practices ≥ 90. Five pages score 100; `/book` scores 77 (Acuity third-party cookies/inspector issues).
- [x] Lighthouse SEO ≥ 95. Measured 100 across all six pages.
- [ ] LCP < 2.5s on simulated 4G. Latest three-run gzip medians: Home 2.65s (fail); other five pages 2.35–2.42s (pass). Raw delivery substantially worsens LCP; actual deployed-host delivery remains to be verified.

**Verification:**
- `pnpm build` + `pnpm start`
- Lighthouse CI or Chrome DevTools Lighthouse panel.

**Expected result:** All pages pass the defined thresholds.

**Completion evidence:** Baseline and optimized JSON reports for all six pages plus `perf-summary.json` in `C:/Users/gabec/AppData/Local/Temp/vqa/`. Exact scores, blockers, changed assets, and viewport evidence are recorded in the PERF-001 entry in `docs/PROGRESS.md`. Reports demonstrate partial progress, not completion.

**Regression considerations:** Do not degrade visual quality for score gains.

**Rollback:** Revert optimization changes.

**Next task:** DEP-001.

---

### DEP-001 — Select host and configure production deployment

**Objective:** Deploy the static site to production with the custom domain.

**Priority:** Critical.

**Status:** NOT STARTED.

**Dependencies:** PERF-001.

**Files to inspect:** `docs/DEPLOYMENT.md`, `apps/web/next.config.ts`, `apps/web/src/lib/site.ts`.

**Files to modify or create:** Host configuration, DNS records (outside repo if required).

**Required implementation:**
1. Select a static host (Vercel, Netlify, Cloudflare Pages, or existing provider).
2. Configure build command (`pnpm build`) and output directory (`dist/`).
3. Set `NEXT_PUBLIC_BOOKING_URL` in host environment once the Easy!Appointments instance is live (BKG-001).
4. Configure custom domain `ohana-barbershop.com`.
5. Verify HTTPS and DNS resolution.
6. Run post-deployment verification checklist.

**Acceptance criteria:**
- [ ] Production URL serves the site over HTTPS.
- [ ] All public routes return 200.
- [ ] `/sitemap.xml` is valid.
- [ ] Easy!Appointments booking wizard loads on `/book`.
- [ ] Contact links work.
- [ ] DNS records are correct.

**Verification:**
- `curl -I https://www.ohana-barbershop.com/`
- Browser smoke test of all pages.
- Lighthouse run on production URL.

**Expected result:** Live production site.

**Completion evidence:** Live URL, DNS records, Lighthouse report.

**Regression considerations:** Ensure email MX records are preserved.

**Rollback:** Revert DNS or redeploy previous build.

**Next task:** HRS-001 (if unblocked) or project closeout.

---

### HRS-001 — Add confirmed business hours to contact page

**Objective:** Display real business hours once confirmed by the owner.

**Priority:** Medium.

**Status:** BLOCKED.

**Dependencies:** Owner confirmation of hours.

**Files to inspect:** `apps/web/src/lib/site.ts`, `apps/web/src/app/contact/page.tsx`.

**Files to modify or create:** `apps/web/src/lib/site.ts`.

**Required implementation:**
1. Obtain confirmed hours from the business owner.
2. Populate `site.hours` array.
3. Verify rendering on `/contact`.
4. Update JSON-LD `openingHours` in layout if schema supports it.

**Acceptance criteria:**
- [ ] Hours are accurate and displayed on `/contact`.
- [ ] JSON-LD reflects hours if applicable.
- [ ] Build passes.

**Verification:**
- `pnpm build`
- Visual inspection of `/contact`.

**Expected result:** Contact page shows real hours.

**Completion evidence:** Owner confirmation (email/message) and screenshot.

**Regression considerations:** None.

**Rollback:** Clear `site.hours`.

**Next task:** GAL-001 (if unblocked) or closeout.

---

### GAL-001 — Add gallery page

**Objective:** Add a gallery page showcasing real haircut and shop photos.

**Priority:** Medium.

**Status:** BLOCKED.

**Dependencies:** Owner-provided photos; HRS-001 optional.

**Files to inspect:** `apps/web/src/app/shop/page.tsx` (for page pattern), `apps/web/src/components/chrome.tsx` (for nav).

**Files to modify or create:** `apps/web/src/app/gallery/page.tsx`, gallery images in `apps/web/public/gallery/`.

**Required implementation:**
1. Obtain approved photos from the owner.
2. Create `/gallery` page with an image grid.
3. Add Gallery link to navigation (desktop and mobile).
4. Add `/gallery` to sitemap.
5. Ensure images are optimized and have descriptive `alt` text.

**Acceptance criteria:**
- [ ] `/gallery` route exists and is reachable from navigation.
- [ ] Images are not stretched and load efficiently.
- [ ] Page is responsive and accessible.
- [ ] Sitemap includes `/gallery`.

**Verification:**
- `pnpm build`
- Manual inspection at all viewports.

**Expected result:** Gallery page is live and visually complete.

**Completion evidence:** Screenshots and build output.

**Regression considerations:** Navigation must remain usable.

**Rollback:** Remove gallery page and nav link.

**Next task:** FRM-001 (if unblocked) or closeout.

---

### FRM-001 — Add contact form with backend

**Objective:** Allow customers to send messages directly from the website.

**Priority:** Low.

**Status:** BLOCKED.

**Dependencies:** Selection of a form backend provider (e.g., Formspree, Netlify Forms, Resend Contact Forms).

**Files to inspect:** `apps/web/src/app/contact/page.tsx`.

**Files to modify or create:** `apps/web/src/app/contact/page.tsx` and any required environment variables.

**Required implementation:**
1. Select a form backend that works with static export.
2. Add a contact form with name, email/phone, message, and submit button.
3. Wire form action to the backend endpoint.
4. Add success and error states.
5. Validate inputs client-side and server-side (via backend).

**Acceptance criteria:**
- [ ] Form is keyboard accessible and has associated labels.
- [ ] Submit succeeds and shows confirmation.
- [ ] Errors are displayed clearly.
- [ ] No custom backend is required.

**Verification:**
- Submit test message through the form.
- Confirm delivery in the backend inbox.

**Expected result:** Working contact form.

**Completion evidence:** Test submission and inbox screenshot.

**Regression considerations:** Direct contact links must remain available.

**Rollback:** Remove form, keep direct links.

**Next task:** Project closeout.

## Quality gates

Every task must pass the applicable gates from PART 7:

- **GATE A — Code correctness:** No syntax errors, no unresolved imports, clean build, no new lint errors, no unused code.
- **GATE B — Functional correctness:** Intended feature works; failure and loading states handled; regression tests pass.
- **GATE C — Security:** No secrets committed; inputs validated; public endpoints protected; customer data not exposed.
- **GATE D — Accessibility:** WCAG 2.2 AA target; keyboard, focus, contrast, labels, reduced motion.
- **GATE E — Visual consistency:** Approved tokens; responsive layouts; no major defects; polished states.
- **GATE F — Integration reliability:** Provider requests succeed; failures handled; credentials private; no false success.
- **GATE G — Release readiness:** Critical workflows pass; no blocker defects; deployment documented; owner acceptance recorded.

## Integration dependencies and blockers

| Dependency | Status | Impact | Action required |
|------------|--------|--------|-----------------|
| Easy!Appointments VPS + hostname | BLOCKED | Booking server exists | Provision VPS, deploy E!A Docker stack, point `book.` hostname (BKG-001). |
| SMTP provider for booking emails | BLOCKED | Booking notifications | Owner decision (Gmail app password or transactional provider). |
| E!A service IDs / deep-link support | Unresolved | Per-service preselection | Create services in E!A admin; verify wizard preselect param (BKG-001). |
| Business hours | BLOCKED | Contact page hours | Confirm hours with owner. |
| Gallery photos | BLOCKED | Gallery page | Collect approved photos from owner. |
| Contact form backend | BLOCKED | Contact form | Select provider with owner. |
| Static host / DNS | BLOCKED | Production deployment | Select host and configure domain. |
| Missed-call provider | BLOCKED | Missed-call integration | Owner decision; not in Phase 1 scope. |
| Chatbot provider | BLOCKED | Chatbot | Not in Phase 1 scope. |
| E-commerce platform | BLOCKED | Merch checkout | Not in Phase 1 scope. |

## Release requirements

Before the site is considered release-ready:

- [ ] Static export configured and building cleanly.
- [ ] All public pages render correctly at 375px, 390px, 768px, 1024px, 1440px.
- [ ] Lighthouse Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 95.
- [ ] All contact links and booking flow verified.
- [ ] Domain configured with HTTPS.
- [ ] Post-deployment checklist completed.
- [ ] Owner acceptance recorded.

## Current project status

- Repository audit complete.
- Architecture, design system, data model, integrations, test plan, deployment, and decisions documented.
- `pnpm build` and `pnpm lint` pass.
- Public pages are implemented but require static export configuration and visual/accessibility polish.
- Booking is migrating from Acuity Scheduling to self-hosted Easy!Appointments (DEC-001, task BKG-001); the Acuity embed remains in code until BKG-001.
- Several content tasks are blocked pending owner input.

## Next executable task

**VIS-002 — Services page visual QA**

Then **BKG-001 — Replace Acuity embed with Easy!Appointments** once its infrastructure blockers (VPS, hostname, SMTP) are cleared; VIS-003 verifies the result.

---

# PART 1 — NON-NEGOTIABLE RULES

## 1.1 No unplanned implementation

Never begin feature implementation without a sufficiently detailed task in `docs/IMPLEMENTATION_PLAN.md`.

Every implementation task must specify:

- The exact objective.
- Prerequisites.
- Relevant existing files.
- Files expected to be created or modified.
- Components involved.
- Detailed implementation instructions.
- Data requirements.
- Error handling.
- Security requirements.
- Responsive behavior.
- Acceptance criteria.
- Verification commands.
- Expected verification results.
- Completion evidence.

If this information cannot yet be determined, create a prerequisite investigation task.

Do not guess.

## 1.2 No unnecessary architectural changes

Inspect the existing repository before selecting technologies.

Preserve the existing framework and working functionality unless there is a documented technical reason to change them.

Prefer existing dependencies and established project conventions.

Do not perform framework migrations or major rewrites simply because another architecture seems more modern.

## 1.3 No vague instructions

The following are NOT acceptable implementation instructions:

- "Make the UI beautiful."
- "Implement secure authentication."
- "Add booking functionality."
- "Optimize the website."
- "Improve responsiveness."
- "Integrate the phone system."
- "Add proper error handling."
- "Test everything."

These statements describe goals, not instructions.

Replace them with concrete specifications describing exactly what to build, where to build it, how it behaves, how it handles failures, and how its correctness is verified.

## 1.4 No fictional progress

Never report a task as complete when:

- Code has not been implemented.
- Required tests have not run.
- The application fails to build.
- The feature only uses fake data when real functionality is required.
- Required provider credentials are unavailable.
- The intended workflow cannot be completed.
- A critical error remains unresolved.

Use the status **BLOCKED** when an external dependency prevents verification.

A functioning mock is not a completed production integration.

## 1.5 No uncontrolled scope expansion

Build only approved features.

Do not add features merely because they are technically interesting.

Preserve the $2,000 preliminary project budget as a planning constraint, not as permission to activate paid services.

Do not provision billable infrastructure without authorization.

## 1.6 Explicit uncertainty handling

When encountering missing information:

1. Search the repository for the answer.
2. Check existing documentation and configuration.
3. Check installed dependency capabilities.
4. Consult official technical documentation when available.
5. Record the unresolved question if it cannot be answered.
6. Identify affected tasks.
7. Continue with independent tasks.

Never fabricate an API, integration capability, customer policy, or business detail.

---

# PART 2 — REQUIRED DOCUMENTATION STRUCTURE

Create and maintain these files:

```text
docs/
├── IMPLEMENTATION_PLAN.md
├── PROGRESS.md
├── ARCHITECTURE.md
├── DESIGN_SYSTEM.md
├── DATA_MODEL.md
├── INTEGRATIONS.md
├── TEST_PLAN.md
├── DEPLOYMENT.md
└── DECISIONS.md
```

Keep the documentation concise enough to be maintainable, but detailed enough to remove implementation ambiguity.

**`IMPLEMENTATION_PLAN.md` is the master document and single entry point.**

The other documents contain detailed specifications referenced by the master plan.

If a specification changes, update its source document and any affected implementation tasks.

Do not maintain contradictory requirements in multiple files.

## 2.1 IMPLEMENTATION_PLAN.md

This file must contain, in order:

1. Project mission.
2. Business requirements.
3. Approved scope and exclusions.
4. Existing repository audit.
5. Selected architecture and justifications.
6. Documentation index.
7. Functional requirements.
8. Nonfunctional requirements.
9. Feature dependencies.
10. Development phases.
11. Atomic implementation tasks.
12. Quality gates.
13. Integration dependencies and blockers.
14. Release requirements.
15. Current project status.
16. Next executable task.

The document must identify the exact next task at all times.

A new agent should not need to search through hundreds of lines to determine where development resumes.

Place a **CURRENT EXECUTION STATE** section near the beginning containing:

```text
Current phase:
Current task ID:
Task status:
Last successful verification:
Known blockers:
Files relevant to current task:
Next required action:
```

Update this section at every meaningful checkpoint.

## 2.2 ARCHITECTURE.md

Document the actual implementation architecture.

Required details:

- Existing technology stack.
- Frontend framework.
- Routing.
- Backend runtime, if needed.
- API architecture.
- Database or managed data source.
- Authentication architecture.
- Authorization strategy.
- Booking provider integration.
- Messaging integration.
- Telephone integration.
- Chatbot architecture.
- E-commerce integration.
- Hosting.
- Deployment.
- Environment variables.
- Third-party service boundaries.
- Data ownership.
- Error handling approach.

Provide a text-based architecture diagram.

Explain how information moves between:

Customer → Website → Booking system → Owner dashboard.

And:

Customer → Messaging provider → Business inbox.

And:

Missed call → Telephone provider → Verified webhook → Notification or SMS.

Do not assume all providers share a common database.

For each major architectural choice, document:

- Chosen solution.
- Why it was selected.
- Alternatives considered.
- Trade-offs.
- Estimated recurring costs.
- Provider limitations.
- Reversal or migration difficulty.

Use provider documentation to verify functionality before finalizing integration choices.

## 2.3 DESIGN_SYSTEM.md

This document is essential for visual quality.

It must define a consistent, implementation-ready visual language based on the existing Ohana development website.

Document:

### Brand direction

Ohana Barbershop is a welcoming, affordable, family-operated shop rooted in Spencer's genuine Hawaiian background.

The design should feel:

- Warm and welcoming.
- Confident and professional.
- Relaxed rather than corporate.
- Natural and authentic.
- Modern but not trendy for its own sake.
- Personal rather than commercialized.

The design must not look like a generic software dashboard or a mass-produced barbershop template.

### Required design tokens

Define actual values for:

- Primary background.
- Secondary background.
- Primary text.
- Secondary text.
- Brand accent.
- Border colors.
- Interactive states.
- Success, warning, and error colors.
- Typography families.
- Font-size scale.
- Line heights.
- Font weights.
- Spacing scale.
- Container widths.
- Border radii.
- Shadows.
- Animation durations.
- Breakpoints.

Derive token values from the existing site where possible.

Do not randomly replace established colors or typography.

Implement reusable CSS variables or the equivalent in the existing styling system.

### Component specifications

Document the expected appearance and behavior of:

- Navigation.
- Mobile menu.
- Buttons.
- Cards.
- Service cards.
- Forms.
- Inputs.
- Date picker.
- Calendar.
- Booking stepper.
- Modals.
- Toast notifications.
- Loading states.
- Empty states.
- Error states.
- Footer.
- Product cards.
- Gallery.
- Chat panel.
- Admin sidebar.

Include disabled, hover, focus, error, and loading states where relevant.

### Page-by-page composition

For every page, specify:

- Primary purpose.
- Target visitor action.
- Section order.
- Layout structure.
- Content hierarchy.
- Visual focal point.
- Calls to action.
- Mobile adaptation.
- Relevant components.
- Required images.
- Expected visual behavior.

Do not leave page composition entirely to the implementing agent.

### Responsive specifications

At minimum, evaluate layouts at:

- 375px: small mobile.
- 390px: common mobile.
- 768px: tablet.
- 1024px: small desktop.
- 1440px: desktop.

These are verification viewports, not necessarily CSS breakpoints.

Define how the layout changes between sizes.

### Visual quality rules

- No clipped text.
- No horizontal scrolling caused by layout defects.
- No stretched images.
- No inconsistent button styles.
- No arbitrary spacing.
- No illegible text.
- No overlapping components.
- No confusing information hierarchy.
- No mismatched icon styles.
- No unexplained empty space.
- No generic stock content presented as authentic business photography.
- No excessive animations.
- No visually unfinished pages.

Maintain consistency without making every section look identical.

### Visual reference protocol

The existing development site is the primary visual reference.

Capture and inspect screenshots of existing and modified pages when browser tools are available.

If screenshots cannot be captured, report that limitation.

Never claim pixel-perfect comparison without actual visual inspection.

## 2.4 DATA_MODEL.md

Document all necessary data structures before implementing persistence.

For each entity, specify:

- Entity name.
- Purpose.
- Field names.
- Data types.
- Required fields.
- Defaults.
- Validation rules.
- Relationships.
- Unique constraints.
- Ownership.
- Read permissions.
- Write permissions.
- Deletion or retention policy.

Expected entities may include:

- Service.
- Barber.
- Availability.
- Appointment.
- Customer.
- BusinessSettings.
- GalleryItem.
- MerchandiseProduct.
- Message.
- CallEvent.

Only create entities actually needed by the selected architecture.

If a booking provider owns appointments, document that ownership rather than creating redundant tables.

Store timestamps in an unambiguous format and render business-local time using `America/Los_Angeles`.

## 2.5 INTEGRATIONS.md

Create a separate integration specification for every external service.

Each specification must contain:

```text
Integration name:
Purpose:
Selected provider:
Provider documentation:
Required credentials:
Environment variables:
Supported features:
Unsupported features:
Inbound data:
Outbound data:
Authentication:
Webhook requirements:
Failure handling:
Retry strategy:
Idempotency:
Rate limits:
Estimated ongoing costs:
Local testing strategy:
Production verification:
Fallback behavior:
Current status:
```

Required integration categories:

- Booking and scheduling.
- Customer messaging.
- Business telephone and missed calls.
- Chatbot, if an LLM is approved.
- E-commerce and hosted checkout.
- Hosting and deployment.

Do not invent integration endpoints or method signatures.

Do not finalize incompatible providers merely because each is individually inexpensive.

Identify whether the chosen solutions can share a single management interface.

## 2.6 TEST_PLAN.md

Create a concrete testing matrix.

For every feature, identify:

- Normal operation.
- Invalid input.
- Failure states.
- Boundary cases.
- Authorization checks.
- Integration errors.
- Responsive behavior.
- Accessibility behavior.
- Regression risks.

Document exact test commands where available.

Separate:

1. Unit tests.
2. Integration tests.
3. End-to-end workflow tests.
4. Security tests.
5. Visual tests.
6. Manual acceptance tests.

A test that was planned but not executed must never be reported as passing.

## 2.7 DEPLOYMENT.md

Document:

- Local setup.
- Required environment variables.
- Installation commands.
- Development commands.
- Build commands.
- Test commands.
- Preview or staging deployment.
- Production deployment process.
- Domain configuration.
- DNS migration plan.
- Existing business email preservation.
- Backup strategy.
- Rollback procedure.
- Post-deployment verification.

Do not modify production DNS without authorization.

## 2.8 DECISIONS.md

Maintain a lightweight architectural decision log.

Format:

```text
Decision ID:
Date:
Problem:
Options:
Selected approach:
Reason:
Consequences:
Status:
```

Document decisions that materially affect cost, maintenance, security, or implementation complexity.

Do not turn routine code changes into unnecessary decision records.

---

# PART 3 — ATOMIC TASK REQUIREMENTS

This is the most important section.

The implementation plan must break development into small, self-contained tasks.

Each task should ideally represent 20–90 minutes of focused development for a competent engineer.

Use smaller tasks for high-risk integrations.

A task must not combine unrelated features.

Every task requires a unique stable identifier.

Example:

`BOOK-004 — Prevent overlapping appointments`

Use the following mandatory format:

## TASK [ID] — [TITLE]

### Objective
Describe exactly one measurable outcome.

### Priority
Critical / High / Medium / Low.

### Status
NOT STARTED / IN PROGRESS / BLOCKED / VERIFYING / COMPLETE.

### Dependencies
List prerequisite task IDs.

### Existing context
Summarize relevant architecture and current behavior.

### Files to inspect
List exact existing files and the reason each is relevant.

### Files to modify or create
List exact expected paths.

Use repository-confirmed paths.

If a path cannot yet be determined, create an investigation task rather than inventing it.

### Required implementation
Write numbered, explicit coding instructions.

Specify:

- Component responsibilities.
- Functions or interfaces.
- Expected inputs.
- Expected outputs.
- Validation rules.
- State transitions.
- Data persistence.
- Error handling.
- Loading behavior.
- Authorization.
- Responsive behavior.
- Integration requirements.

### Forbidden shortcuts
Document shortcuts that would create incorrect behavior.

### Acceptance criteria
Use independently testable checkboxes.

Every criterion must describe observable behavior.

### Verification
Provide exact commands and manual test steps.

### Expected result
Describe what successful verification looks like.

### Completion evidence
List test results, screenshots, or other artifacts needed to prove completion.

### Regression considerations
Identify existing behavior that must remain functional.

### Rollback
Describe how to reverse the change safely.

### Next task
Specify the task to execute after successful verification.

---

# PART 4 — TASK GRANULARITY EXAMPLES

BAD TASK:

"Build the booking system."

This is too broad.

GOOD TASK BREAKDOWN:

- BOOK-001: Inspect booking provider capabilities.
- BOOK-002: Define services and appointment durations.
- BOOK-003: Define availability data contract.
- BOOK-004: Implement service selection.
- BOOK-005: Implement date selection.
- BOOK-006: Display available time slots.
- BOOK-007: Implement customer information form.
- BOOK-008: Implement server-side booking validation.
- BOOK-009: Prevent duplicate and conflicting bookings.
- BOOK-010: Save booking through authoritative provider.
- BOOK-011: Implement confirmation and failure states.
- BOOK-012: Implement cancellation workflow.
- BOOK-013: Implement rescheduling workflow.
- BOOK-014: Connect admin appointment calendar.
- BOOK-015: Test booking system end to end.

Each task must contain its own implementation and verification instructions.

BAD TASK:

"Build a beautiful homepage."

GOOD TASK BREAKDOWN:

- UI-001: Audit current homepage styles and assets.
- UI-002: Define approved design tokens.
- UI-003: Build responsive navigation.
- UI-004: Refine hero composition and typography.
- UI-005: Build services preview.
- UI-006: Build About preview.
- UI-007: Build gallery preview.
- UI-008: Implement booking call to action.
- UI-009: Refine footer.
- UI-010: Validate mobile responsive layout.
- UI-011: Perform visual quality review.

This degree of specificity is mandatory.

---

# PART 5 — FEATURE CONTRACTS

The plan must explicitly define the following features.

## 5.1 Public website

Required:

- Home.
- Services.
- About.
- Gallery.
- Contact.
- Booking.
- Merchandise.

Each page must have:

- Defined content.
- Defined components.
- Defined mobile layout.
- Verified navigation.
- Metadata.
- Loading and failure behavior where applicable.

Do not invent service prices, owner biographies, merchandise, photographs, or customer testimonials.

## 5.2 Booking and calendar

The plan must specify:

- Single source of appointment truth.
- Booking flow.
- Service selection.
- Appointment duration.
- Barber assignment.
- Operating hours.
- Breaks and closures.
- Timezone behavior.
- Availability computation.
- Conflict prevention.
- Cancellation.
- Rescheduling.
- Confirmation.
- Error handling.
- Repeated submissions.
- Concurrent booking behavior.

Do not use client-only checks to prevent double bookings.

The final submission must be validated against authoritative availability.

## 5.3 Owner dashboard

The plan must define:

- Authentication.
- Authorization.
- Dashboard layout.
- Appointment list.
- Day and week calendar views.
- Appointment editing.
- Manual appointment creation.
- Appointment cancellation.
- Business hours.
- Closures.
- Service management.
- Content editing.
- Gallery management.

Define which actions are possible and which backend is responsible for them.

A visually complete dashboard with nonfunctional buttons is not acceptable.

## 5.4 Messaging

Specify:

- Customer entry point.
- Messaging provider.
- Message storage owner.
- Delivery confirmation.
- Message failure behavior.
- Administrator access.
- Customer privacy.
- Spam protection.
- Human handoff.

Do not create multiple unconnected inboxes without a documented reason.

## 5.5 Missed-call integration

Verify the existing telephone provider before implementing.

Specify:

- How missed calls are detected.
- How events reach the application.
- How events are authenticated.
- How duplicates are prevented.
- When automatic SMS is permitted.
- Consent and opt-out handling.
- Notification behavior.
- Failure behavior.
- Provider costs.

If the phone provider cannot expose missed-call events, mark this integration BLOCKED pending a provider decision.

## 5.6 Live chatbot

The chatbot should primarily answer common business questions.

Prefer approved FAQ content over unrestricted generation.

Specify:

- Knowledge source.
- Supported questions.
- Unsupported questions.
- Human contact fallback.
- Safe response behavior.
- Rate limits.
- Abuse prevention.
- Provider outage behavior.
- API cost safeguards.

The chatbot may only access customer-specific information through explicitly authorized, validated application operations.

It must not invent appointment availability or create bookings without confirmed server-side operations.

## 5.7 Merchandise

Specify:

- Storefront integration.
- Product information.
- Product availability.
- Hosted checkout.
- Payment confirmation.
- Error states.
- Inventory ownership.
- Order management ownership.

Never collect raw credit card details through custom website forms.

---

# PART 6 — VISUAL QUALITY ASSURANCE

A successful build is not sufficient evidence of quality.

Every public-facing page requires a visual acceptance process.

## Step 1 — Capture

When browser automation is available, capture the page at:

- 375px.
- 390px.
- 768px.
- 1024px.
- 1440px.

Use a consistent viewport height where practical and capture full-page screenshots.

## Step 2 — Inspect

Check:

- Layout balance.
- Text hierarchy.
- Component alignment.
- Section spacing.
- Image cropping.
- Navigation clarity.
- Button prominence.
- Color consistency.
- Border consistency.
- Card consistency.
- Content readability.
- Whitespace.
- Mobile usability.
- Overall visual coherence.

## Step 3 — Compare

Compare against:

1. The existing Ohana development website.
2. The approved design system.
3. The page layout specification.
4. Previously approved pages.

Avoid visual drift between development stages.

## Step 4 — Identify defects

Classify visual issues:

**Critical**
- Unusable navigation.
- Content obscured.
- Broken mobile layout.
- Inaccessible primary actions.

**Major**
- Poor hierarchy.
- Inconsistent spacing.
- Broken imagery.
- Major responsive inconsistencies.

**Minor**
- Small alignment differences.
- Slight spacing inconsistencies.
- Nonessential visual polish.

## Step 5 — Correct

Fix critical and major issues before marking the page complete.

## Step 6 — Verify

Capture updated screenshots where possible.

Record the outcome.

Do not claim a visual inspection occurred when screenshots or a rendered browser were unavailable.

---

# PART 7 — FUNCTIONAL QUALITY GATES

Every task must pass applicable quality gates.

## GATE A — Code correctness

Required:

- No syntax errors.
- No unresolved imports.
- No broken builds.
- No new type-checking errors.
- No new lint errors where linting is configured.
- No unused code introduced without justification.
- No unrelated modifications.

## GATE B — Functional correctness

Required:

- Intended feature works.
- Input validation works.
- Failure states work.
- Loading states work.
- State changes persist when required.
- Relevant regression tests pass.

## GATE C — Security

Required:

- Authorization is enforced server-side.
- Sensitive information is protected.
- Inputs are validated.
- Credentials are never exposed.
- Public endpoints have appropriate abuse controls.
- Required webhook signatures are verified.
- Customer information is not publicly accessible.

Use OWASP-aligned security practices.

## GATE D — Accessibility

Target WCAG 2.2 AA.

Required:

- Semantic structure.
- Keyboard access.
- Visible focus.
- Associated input labels.
- Usable error messages.
- Sufficient contrast.
- Meaningful accessible names.
- Logical focus order.
- Usable touch controls.

## GATE E — Visual consistency

Required:

- Approved design tokens.
- Consistent components.
- Responsive layouts.
- No major visual defects.
- Clear hierarchy.
- Polished empty, loading, and error states.

## GATE F — Integration reliability

Required where applicable:

- Provider request succeeds.
- Provider failure is handled.
- Credentials remain private.
- Webhooks are authenticated.
- Duplicate events are handled safely.
- Failed operations never display false success.
- Relevant retry behavior is safe.

## GATE G — Release readiness

Required before production:

- All approved critical workflows pass.
- No known blocker-level or critical defects.
- No known high-severity security defects.
- No known major accessibility barriers.
- No known major responsive layout defects.
- External integrations are verified with production configuration.
- Deployment and rollback procedures are documented.
- Business data and content are approved.
- Owner acceptance is recorded.

An application cannot be marked release-ready merely because automated tests pass.

---

# PART 8 — DEVELOPMENT ORDER

Use dependency-driven implementation.

Recommended sequence:

### PHASE 0 — Discovery and specification
Audit repository, select architecture, document decisions, and create the complete engineering plan.

### PHASE 1 — Design system
Establish visual tokens, reusable components, navigation, layouts, and responsive foundations.

### PHASE 2 — Public pages
Build and polish Home, Services, About, Gallery, Contact, and merchandise presentation.

### PHASE 3 — Backend foundation
Implement only the server-side capabilities required by selected integrations and administration.

### PHASE 4 — Booking
Implement service selection, availability, booking, confirmations, cancellation, and rescheduling.

### PHASE 5 — Owner administration
Implement secure authentication, appointment management, calendar, and website content management.

### PHASE 6 — Customer communications
Implement the approved messaging channel and telephone integration.

### PHASE 7 — Chatbot
Implement an approved business-information assistant and human handoff.

### PHASE 8 — Merchandise checkout
Complete product and purchase workflows using the selected commerce provider.

### PHASE 9 — Hardening
Perform security, accessibility, performance, reliability, responsive, and visual testing.

### PHASE 10 — Production preparation
Prepare configuration, deployment, redirects, domain migration, backups, owner training, and acceptance testing.

Some phases may be reordered when a documented dependency requires it.

Do not leave substantial design polish exclusively to PHASE 9.

Visual quality must be verified continuously.

---

# PART 9 — ERROR RECOVERY PROTOCOL

When code fails:

1. Read the complete error message.
2. Identify the failing file and operation.
3. Determine the most likely root cause using available evidence.
4. Inspect related implementation and configuration.
5. Make the smallest justified correction.
6. Rerun the failing verification.
7. Rerun relevant regression tests.
8. Document the resolution.

Do not randomly change unrelated files.

Do not repeatedly retry an identical failed command without changing anything.

Do not suppress errors simply to make tests pass.

Do not remove required functionality to avoid a failing test.

When unable to solve a problem:

- Record the actual error.
- Describe what was attempted.
- Identify current hypotheses as unverified.
- Mark the task BLOCKED.
- Continue only with independent tasks.

---

# PART 10 — AGENT CONTEXT MANAGEMENT

Assume the development agent may lose its working context between sessions.

All important decisions must be written to the repository.

At the beginning of every session:

1. Read `docs/IMPLEMENTATION_PLAN.md`.
2. Read `docs/PROGRESS.md`.
3. Read the current task.
4. Read only the supporting specifications relevant to that task.
5. Inspect relevant source files.
6. Check repository status.
7. Confirm the last successful verification.
8. Resume the documented task.

Do not rediscover completed architectural decisions.

Do not reread unrelated project files unnecessarily.

At the end of every task:

1. Update its status.
2. Record modified files.
3. Record tests executed.
4. Record test results.
5. Update discovered dependencies.
6. Record unresolved issues.
7. Update the current execution state.
8. Identify the next executable task.

Prefer small, reviewable commits where repository permissions and workflow allow.

Never overwrite unrelated uncommitted changes.

If another developer's changes are present, inspect them before editing overlapping files.

---

# PART 11 — TASK EXECUTION CONTRACT

When instructed to implement a task, use this process.

### STEP 1 — READ

Read the task and required specifications.

### STEP 2 — INSPECT

Read relevant code.

Do not guess existing interfaces.

### STEP 3 — PLAN

Write a brief internal implementation checklist.

### STEP 4 — IMPLEMENT

Make small, targeted changes.

### STEP 5 — VERIFY

Execute the task's required checks.

### STEP 6 — REVIEW

Inspect changed files and compare against acceptance criteria.

### STEP 7 — CORRECT

Fix identified defects.

### STEP 8 — DOCUMENT

Update project tracking.

### STEP 9 — REPORT

Provide:

```text
TASK:
STATUS:

IMPLEMENTED:
- ...

FILES CHANGED:
- ...

TESTS EXECUTED:
- ...

TEST RESULTS:
- ...

VISUAL VERIFICATION:
- ...

KNOWN ISSUES:
- ...

NEXT TASK:
```

Do not include lengthy descriptions of trivial code operations.

Prioritize concrete evidence.

Never call a task COMPLETE unless its required acceptance criteria are met.

---

# PART 12 — PLAN VALIDATION AUDIT

Before declaring `IMPLEMENTATION_PLAN.md` complete, audit the plan itself.

A plan is insufficient if the implementing agent must invent important details.

Perform the following checks.

## Architectural completeness

- [ ] Existing repository has been inspected.
- [ ] Proposed stack is documented.
- [ ] Hosting approach is documented.
- [ ] Data ownership is established.
- [ ] Authentication and authorization are specified.
- [ ] External service boundaries are defined.
- [ ] Integration limitations are identified.
- [ ] Recurring service costs are documented or marked unresolved.

## Functional completeness

- [ ] Every approved website page has a specification.
- [ ] Every customer workflow has a specification.
- [ ] Every owner workflow has a specification.
- [ ] Appointment management behavior is defined.
- [ ] Messaging behavior is defined.
- [ ] Missed-call behavior is defined.
- [ ] Chatbot behavior is defined.
- [ ] Merchandise behavior is defined.
- [ ] Failure cases are addressed.

## Visual completeness

- [ ] Design tokens are defined.
- [ ] Typography rules are defined.
- [ ] Layout rules are defined.
- [ ] Page compositions are described.
- [ ] Components have consistent states.
- [ ] Responsive expectations are defined.
- [ ] Visual verification is required.
- [ ] Existing design identity is preserved.

## Implementation completeness

- [ ] Tasks have stable IDs.
- [ ] Tasks are small and independently verifiable.
- [ ] Dependencies are documented.
- [ ] Actual repository paths are used.
- [ ] Each task describes concrete behavior.
- [ ] Each task has acceptance criteria.
- [ ] Each task has verification procedures.
- [ ] Unresolved decisions are explicitly blocked.
- [ ] The next task is unambiguous.

## Quality completeness

- [ ] Relevant tests are specified.
- [ ] Security requirements are explicit.
- [ ] Accessibility requirements are explicit.
- [ ] Integration failures are covered.
- [ ] Critical user journeys have end-to-end tests.
- [ ] Visual review is required.
- [ ] Deployment and rollback are documented.
- [ ] Release acceptance criteria are defined.

For every unchecked item, either correct the plan or record a specific blocker.

Do not claim the plan is fully implementation-ready if critical information is missing.

---

# PART 13 — SELF-CONTAINED PLAN TEST

This is the final planning quality test.

Imagine a completely new coding agent is assigned the project.

It has:

- Access to the repository.
- Access to the documentation.
- No memory of previous conversations.
- Limited reasoning ability.
- Limited context capacity.

Ask:

1. Can it identify exactly which task to work on next?
2. Can it locate the relevant code?
3. Can it determine what must change?
4. Can it understand the desired behavior?
5. Can it identify the relevant visual specifications?
6. Can it implement the task without inventing an architecture?
7. Can it test its implementation?
8. Can it determine whether the task is complete?
9. Can it recover if a test fails?
10. Can another agent resume after it stops?

If the answer to any question is NO, improve the documentation.

The master implementation plan must be usable as a deterministic execution roadmap.

---

# PART 14 — FIRST EXECUTION INSTRUCTIONS

Begin by auditing the current Ohana Barbershop repository.

Do not begin feature development yet.

Perform the following:

1. Inspect repository structure.
2. Identify technology stack.
3. Analyze the existing design system.
4. Inspect current page functionality.
5. Identify existing integrations.
6. Identify reusable components and assets.
7. Determine current hosting requirements.
8. Identify missing business information.
9. Propose the simplest reliable application architecture.
10. Identify all external provider decisions.
11. Create the required documentation.
12. Decompose the project into atomic implementation tasks.
13. Add dependencies and verification criteria.
14. Audit plan completeness.
15. Update CURRENT EXECUTION STATE.

Then provide a concise report containing:

- Repository findings.
- Recommended architecture.
- Proposed integrations.
- Visual design direction.
- Major risks.
- Decisions requiring owner approval.
- Approximate task count.
- Next executable task.

**STOP after creating and auditing the plan. Do not start implementation until the plan is approved.**

## FINAL PRINCIPLE

Do not optimize for the amount of code written.

Optimize for verified, polished, reliable functionality.

A feature is not finished because it exists.

A feature is finished when it works, looks intentional, handles failures, protects users, integrates correctly, and meets its documented acceptance criteria.

The completed Ohana Barbershop website should feel like a thoughtfully designed professional product while remaining simple enough for a small family-owned business to operate every day.