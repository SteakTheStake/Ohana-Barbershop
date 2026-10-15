# Ohana Barbershop — Progress Log

## Task registry

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| PLAN-001 | Audit repository and create implementation plan | COMPLETE | Docs created; build/lint pass. |
| CFG-001 | Configure static export and production build | COMPLETE | Static export to `out/` verified; all routes 200. |
| SEO-001 | Add page-specific metadata and descriptions | COMPLETE | Unique titles/descriptions/OG on all pages. |
| VIS-001 | Home page visual QA and responsive fixes | COMPLETE | Fixed hero heading clip at 768–1023px; no overflow at any viewport. |
| VIS-002 | Services page visual QA | COMPLETE | Added visible focus-visible state on rows; all links/tap targets verified. |
| BKG-001 | Replace Acuity embed with Easy!Appointments | BLOCKED | Needs VPS + SMTP decision; see DEC-001. |
| VIS-003 | Book page visual QA and booking fallback | COMPLETE | Added client-side scheduler failure detection + fallback; verified at all viewports. |
| VIS-004 | About page visual QA | COMPLETE | No defects found; verified at all viewports. |
| VIS-005 | Contact page visual QA | COMPLETE | All links verified; tap targets 110px; hours rendering tested and reverted. |
| VIS-006 | Shop page visual QA | COMPLETE | Teaser card verified; Instagram link opens in new tab. |
| A11Y-001 | Accessibility audit and fixes | COMPLETE | Global focus rings, h1 per page, contrast fixes, tap targets; verified via CDP. |
| PERF-001 | Performance optimization and Lighthouse audit | BLOCKED | Logo/font fixes plus animation-loop lifecycle tests. Under verified gzip delivery five pages pass Performance/LCP medians; Home and Acuity Best Practices still block completion. |
| DEP-001 | Select host and configure production deployment | NOT STARTED | |
| HRS-001 | Add confirmed business hours to contact page | BLOCKED | Awaiting owner confirmation of hours. |
| GAL-001 | Add gallery page | BLOCKED | Awaiting owner-provided photos. |
| FRM-001 | Add contact form with backend | BLOCKED | Awaiting form backend provider selection. |

## Execution log

### 2026-10-14 — Booking platform decision updated (Acuity → Easy!Appointments)

- Business dropped Acuity Scheduling; requirement is now a fully open-source, self-hostable scheduling platform the business owns.
- Evaluated Easy!Appointments (GPL-3.0), Cal.diy (MIT fork of Cal.com — heavy, flagged non-production upstream), WordPress + booking plugin, custom engine, and proprietary SaaS.
- Selected **Easy!Appointments**: service-business data model (services/providers/working plans/customers), REST API + `openapi.yml`, official Docker Compose stack, actively maintained since 2014.
- Rewrote DEC-001 in `docs/DECISIONS.md`; updated `docs/INTEGRATIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/TEST_PLAN.md`, `docs/DEPLOYMENT.md`, `docs/DESIGN_SYSTEM.md`, `PLAN.md`, and this file.
- Added task **BKG-001 — Replace Acuity embed with Easy!Appointments** to `docs/IMPLEMENTATION_PLAN.md` (BLOCKED on VPS + SMTP); VIS-003 now verifies the booking embed after BKG-001.
- Env var renamed: `NEXT_PUBLIC_ACUITY_URL` → `NEXT_PUBLIC_BOOKING_URL`; data field `acuityTypeId` → `bookingServiceId` (rename lands with BKG-001).
- No code changes made yet — `acuity-embed.tsx`, `site.ts`, and Acuity copy remain in `apps/web` until BKG-001.

### 2026-10-14 — PLAN-001 in progress

- Read `docs/IMPLEMENTATION_PLAN.md` and `docs/PROGRESS.md`.
- Audited repository structure, stack, and existing pages.
- Verified `pnpm install`, `pnpm build`, and `pnpm lint` pass.
- Created engineering documentation:
  - `docs/ARCHITECTURE.md`
  - `docs/DESIGN_SYSTEM.md`
  - `docs/DATA_MODEL.md`
  - `docs/INTEGRATIONS.md`
  - `docs/TEST_PLAN.md`
  - `docs/DEPLOYMENT.md`
  - `docs/DECISIONS.md`
- Updated `docs/IMPLEMENTATION_PLAN.md` with project-specific plan, atomic tasks, and current execution state.
- Updated `docs/PROGRESS.md`.
- Marked PLAN-001 COMPLETE after `pnpm build` and `pnpm lint` passed.

### 2026-10-14 — CFG-001 complete

- Configured `output: "export"` and `images: { unoptimized: true }` in `apps/web/next.config.ts`.
- Added `export const dynamic = "force-static"` to `apps/web/src/app/sitemap.ts`.
- Refactored `/book` to use a client component with `useSearchParams` wrapped in `Suspense` for static export compatibility.
- Verified `pnpm build` and `pnpm lint` pass.
- Verified static output contains `index.html`, `services.html`, `book.html`, `about.html`, `contact.html`, `shop.html`, `sitemap.xml`, and `404.html`.
- Verified all routes return HTTP 200 when served from `apps/web/out/`.
- Marked CFG-001 COMPLETE.

## Known blockers

- **PERF-001 release gate:** Under verified local gzip delivery, Home still fails Performance/LCP medians (82 / 2.65s); other five pages pass those thresholds. `/book` Best Practices remains 77 due to Acuity cookies pending BKG-001. Production compression/cache headers remain unverified. Font preloads and accumulated animation loops are fixed; see the latest continuation entry.
- **Business hours:** Need owner confirmation before populating `site.hours`.
- **Gallery photos:** Need owner-provided, approved photos.
- **Contact form backend:** Need owner approval of provider (e.g., Formspree, Netlify Forms, Resend Contact Forms).
- **Static host / DNS:** Need owner decision on hosting provider.
- **Easy!Appointments hosting:** Need a VPS (~$5–$10/mo) and `book.` hostname + DNS for the self-hosted booking server (BKG-001).
- **SMTP for booking emails:** Need provider decision (Gmail app password or transactional service) for E!A notifications.
- **Per-service deep links:** Verify whether the E!A booking wizard supports a service preselect URL parameter (BKG-001).
- **Missed-call integration, chatbot, e-commerce checkout:** Explicitly out of scope for Phase 1.

## Next required action

### 2026-10-14 — SEO-001 complete

- Added unique `Metadata` exports to `page.tsx`, `services/page.tsx`, `book/page.tsx`, `about/page.tsx`, `contact/page.tsx`, and `shop/page.tsx`.
- Each page now has a unique `<title>`, `<meta name="description">`, and Open Graph `title`/`description`/`image`.
- Verified `pnpm build` and `pnpm lint` pass.
- Verified generated HTML contains correct metadata for all public pages.
- Marked SEO-001 COMPLETE.

### 2026-10-14 — VIS-001 complete

- Captured real device-emulated screenshots (Chrome CDP `Emulation.setDeviceMetricsOverride`) at 375px, 390px, 768px, 1024px, and 1440px in dev and production static output.
- Diagnosed and fixed a hero defect: at 768–1023px the `OceanText` span wrapped `Island Vibez.` to two invisible lines while the WebGL canvas drew a single-line mask sized to the wrapped box, clipping the trailing "Z." (`ISLAND VIBE` rendered).
- Fix: `page.tsx` `md:text-8xl` → `lg:text-8xl` (8xl only fits the grid column from `lg`); added `.ocean-text { white-space: nowrap; }` in `globals.css` so DOM text can never wrap-mismatch the canvas mask.
- Root-caused an earlier false positive: headless Chrome `--window-size` sets window (not viewport) size and clamps to a ~580px minimum, so "375px" screenshots were actually 548px viewports cropped to 375px — the apparent mobile horizontal overflow was a tooling artifact, not a site bug. Verified `documentElement.scrollWidth === clientWidth` at all viewports.
- Verified `prefers-reduced-motion: reduce` emulation disables `.animate-drift` and `.shine-text` animations; `OceanText` skips its RAF loop and falls back to visible DOM text when WebGL is unavailable (`if (!gl) return` before `data-gl` is set).
- Kept `next.config.ts` dev/prod split (`output: "export"` only outside `PHASE_DEVELOPMENT_SERVER`) to prevent `.next` manifest corruption during `next dev`.
- Verified `pnpm build` and `pnpm lint` pass.
- Marked VIS-001 COMPLETE.

### 2026-10-14 — VIS-002 complete

- Captured CDP device-emulated screenshots of `/services` at 375/390/768/1024/1440px from the production static build; no horizontal overflow at any viewport (`scrollWidth === clientWidth`).
- Verified all 5 service rows render with names, Hawaiian names, blurbs, and right-aligned prices.
- Verified row links: `/book?service=haircut|skin-fade|buzz|keiki|beard`.
- Verified mobile tap targets: rows measure 96px tall (≥44px required).
- Verified "Book →" hover hint is `hidden` below `md` and occupies in-flow space at `md+` (no content obscuring or layout shift).
- Fixed invisible keyboard focus: browser default outline computed to `1px` near-black on the dark theme — effectively invisible. Added `focus-visible:bg-coal outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-reef` to service rows; verified via real Tab keypress (`solid 2px reef`, captured screenshot).
- Fixed recurring `.next` corruption: `next.config.ts` now gives dev a separate `distDir` (`.next-dev`) so concurrent `next dev` + `next build` no longer corrupt each other; added `.next-dev` to eslint ignores and `.gitignore`. Verified `next dev` boots and serves 200s with the new dir.
- Verified `pnpm build` and `pnpm lint` pass.
- Marked VIS-002 COMPLETE.

### 2026-10-14 — VIS-003 complete

- Reviewed the booking/scheduling decision changes (DEC-001 → Easy!Appointments): docs are internally consistent; code intentionally keeps the Acuity embed until BKG-001; the forward-compatible `bookingUrl` helper rename is in place. Noted for BKG-001: `bookingUrl` still appends the Acuity-specific `?appointmentType=` param.
- Captured CDP device-emulated screenshots of `/book` at 375/390/768/1024/1440px; no horizontal overflow at any viewport; bone rounded iframe container per design system.
- Implemented the required client-side fallback in `acuity-embed.tsx`: cross-origin iframes fire `load` even for error pages, so the component now (1) probes the scheduler with a `no-cors` fetch (rejects on DNS/connection failure), (2) renders the iframe after a reachable probe, (3) keeps a 10s `load`-timeout backstop, and (4) shows a compact fallback card (Call / Text / Email) when the scheduler is unreachable. Same logic carries into BKG-001's `BookingEmbed`.
- Verified the failure path with CDP network interception (blocked `as.me`/`acuityscheduling`): fallback card renders with working `tel:`/`sms:`/`mailto:` links; screenshot captured.
- Verified `/book?service=haircut` renders the in-page heading `Book · Haircut` (document.title is build-time static per static export — documented nuance).
- Added `.animate-pulse` (new checking-state skeleton + existing book skeleton) to the `prefers-reduced-motion` disable list.
- Verified `pnpm build` and `pnpm lint` pass.
- Marked VIS-003 COMPLETE.

### 2026-10-14 — VIS-004 complete

- Captured CDP device-emulated screenshots of `/about` at 375/390/768/1024/1440px from the production static build.
- Verified fact list (From / Now / Ohana) readability and alignment: `dt` fixed-width `w-20` keeps all keys column-aligned; Hawaiian names render correctly with diacritics (ʻHauʻulaʻ, ʻKiaʻiʻ).
- Verified the decorative flower icon is `hidden` below `md` and sits in its own grid column (`md:grid-cols-[1fr_auto]`) at `md+` — no overlap with the text column at any width.
- Verified BOOK NOW CTA visible and reachable on every viewport.
- No horizontal overflow at any viewport (`scrollWidth === clientWidth`).
- No defects found; no code changes required. `pnpm build` and `pnpm lint` already pass (no changes since VIS-003 verification).
- Marked VIS-004 COMPLETE.

### 2026-10-14 — VIS-005 complete

- Captured CDP device-emulated screenshots of `/contact` at 375/390/768/1024/1440px from the production static build; no horizontal overflow at any viewport.
- Verified all contact links: cards use `tel:+14583098765`, `sms:+14583098765`, `mailto:ohanabarbershop1@gmail.com`, and `https://instagram.com/ohana_barber541`; footer adds phone, email, Instagram, and Facebook (`https://facebook.com/profile.php?id=61573216836263`) — all correct.
- Verified tap targets: contact cards measure 110px tall (≥44px required) at mobile widths.
- Verified the hours/location card fallback ("By appointment · Albany, OR" + address) renders correctly while `site.hours` is `null`.
- Temporarily populated `site.hours` (Mon–Fri / Saturday / Sunday) and verified the hours list renders with day/time rows and sand-colored times; captured screenshot; reverted the data and rebuilt — `git diff site.ts` confirms zero residual changes.
- `pnpm build` and `pnpm lint` pass after the revert.
- No defects found; no permanent code changes required. Marked VIS-005 COMPLETE.

### 2026-10-14 — VIS-006 complete

- Captured CDP device-emulated screenshots of `/shop` at 375/390/768/1024/1440px from the production static build; no horizontal overflow at any viewport.
- Verified typography hierarchy: `text-6xl` display heading on the kapa-textured coal card, ember niho band, reef-colored follow link.
- Verified the Instagram link: `https://instagram.com/ohana_barber541` with `target="_blank" rel="noreferrer"` — reachable, opens in a new tab.
- Verified the teaser card is centered (measured card center within 2px of viewport center).
- Minor observation logged for A11Y-001: the follow link's tap area is text-height only (~24px) — below the 44px touch guideline.
- No defects found per this task's acceptance criteria; no code changes required. `pnpm build` and `pnpm lint` already green (no changes since VIS-005 revert).
- Marked VIS-006 COMPLETE.

### 2026-10-14 — A11Y-001 complete

Audit (production build, CDP device emulation across all six pages):
- Keyboard Tab walkthrough reached every interactive element; focus outline computed on each stop.
- Measured all interactive target sizes (WCAG 2.5.8 minimum 24×24px).
- Computed WCAG contrast ratios for every token/text/background combination in use.
- Extracted heading outlines and image/aria inventories per page.
- Verified `prefers-reduced-motion` disables `.animate-drift`, `.wave-edge`, `.shine-text`, `.sparkle` on the build.

Fixes:
- Global visible focus: `a:focus-visible, button:focus-visible { outline: 2px solid reef; outline-offset: 2px }` in `globals.css` base layer — the browser default ring computed `1px` near-black (invisible on the dark theme). Verified 0 invisible focus stops across all six pages; screenshots captured.
- Heading hierarchy: `SectionTitle` gained an `as` prop; `/services`, `/book`, `/about`, `/contact`, `/shop` now render a single `h1` (previously started at `h2`); home keeps hero `h1` + section `h2`.
- Contrast: `text-sand/60` → `text-sand/70` (4.07:1 → 5.17:1, was below the 4.5:1 AA threshold) in footer tagline, greeting translation, and service Hawaiian names; booking-fallback "Text" button border `ink/30` → `ink/50` (1.97:1 → 3.48:1, WCAG 1.4.11 UI boundary).
- Tap targets: desktop header nav links and footer phone/email/social links were 17–20px tall; added compensating vertical padding (`py-2 -my-2`, `py-1.5 -my-1.5`) so targets exceed 24px without layout shift.
- Booking embed note: the iframe's outer element never matches `:focus`/`:focus-visible` in Chrome (focus is delegated to the embed's inner document, which draws its own indicators) — no outer ring is possible via CSS; all first-party controls verified visible.
- The `/book` inline "Call" sentence link is exempt from 2.5.8 (inline-in-sentence exception); all other targets ≥24px.
- `pnpm build` and `pnpm lint` pass.

Marked A11Y-001 COMPLETE.

### 2026-10-14 — PERF-001 partial; BLOCKED

- Ran actual Lighthouse 13.5.0 mobile navigation audits (default simulated throttling, installed Chrome 155) on the production static export for all six pages, before and after optimization. No booking requests were submitted and no third-party resources were excluded from the audits. These are individual lab samples, not medians or production-host guarantees.
- Preserved the original `logo.webp` for Open Graph/JSON-LD. Generated aspect-preserving WebP derivatives with Pillow (LANCZOS, quality 90): `logo-header.webp` (96×127, 3,062 bytes) and `logo-hero.webp` (640×849, 69,444 bytes). Header previously fetched the 315,696-byte original on every page; now it uses the small derivative. Home logo transfers total 72,506 bytes instead of 315,696 (~77% less).
- Updated only the header/home image sources and hero dimensions; kept priority preloads and added explicit `fetchPriority="high"` to the hero. No new runtime dependency, design changes, or booking-provider migration.
- Verified production HTML image/preload assertions, original OG reference retention, and HTTP 200 for all six pages and both derivatives (`node perf-regression.mjs`). Confirmed zero font preloads on every page.
- Visually inspected fresh home screenshots at 375/390/768/1024/1440px; logos remain readable/proportional and `scrollWidth === clientWidth` at all sizes. Screenshots: `C:/Users/gabec/AppData/Local/Temp/vqa/perf-home-<width>.png`.
- `pnpm build` and `pnpm lint` pass. `git diff --check` initially flagged existing Markdown hard-break trailing spaces in CURRENT EXECUTION STATE; rewrote that section as a list without trailing spaces.

Final Lighthouse results (Performance / Accessibility / Best Practices / SEO):

| Page | Baseline Performance | Final Performance | Accessibility | Best Practices | SEO | Final LCP |
|------|----------------------|-------------------|---------------|----------------|-----|-----------|
| Home | 71 | 73 | 100 | 100 | 100 | 5.53s |
| Services | 79 | 81 | 100 | 100 | 100 | 4.82s |
| Book | 76 | 77 | 96 | 77 | 100 | 5.64s |
| About | 77 | 79 | 100 | 100 | 100 | 5.20s |
| Contact | 79 | 81 | 100 | 100 | 100 | 4.76s |
| Shop | 75 | 81 | 100 | 100 | 100 | 4.77s |

Exact unresolved issues:
- Performance ≥90 and simulated LCP <2.5s fail on all six pages. Do not mark the task complete or advance to DEP-001.
- `next/font` font files are self-hosted and use `font-display: swap`, but exported HTML has no font preload links; `.next/server/next-font-manifest.json` has an empty `app` map. The critical CSS→font request chain is present in reports. The framework's Windows font-manifest collection needs further investigation; its root cause is not yet proven or fixed. No hard-coded hashed font URLs or font/design replacements were introduced.
- The local Python static server sends neither transfer compression nor production cache headers; Lighthouse flags render-blocking CSS, uncompressed JS/HTML, a large footer SVG, and unused framework JS. Host compression/cache behavior must be checked separately; these measurements are not claims about the eventual CDN.
- `/book` Best Practices 77: Acuity placeholder `PHPSESSID` third-party cookies and related Chrome inspector issues. Provider migration is BKG-001, blocked on owner VPS/DNS/SMTP decisions. Hiding the embed or excluding its requests would not demonstrate a passing booking page.
- `/book` Accessibility 96 still passes this task's threshold, but Lighthouse found an existing inline phone link distinguishable only by color (`link-in-text-block`); record this as an A11Y follow-up, not a claim of full WCAG compliance.
- Evidence JSON: `C:/Users/gabec/AppData/Local/Temp/vqa/baseline-<page>.json`, `optimized-<page>.json`, and `perf-summary.json` (`<page>` = home/services/book/about/contact/shop). Reproduction commands are in `docs/TEST_PLAN.md`.

### 2026-10-14 — PERF-001 continuation: font preload root cause fixed

- Reproduced the empty font manifest on an ordinary build. Used a temporary Node diagnostic hook outside the repository to inspect Webpack's real font module requests; no diagnostic code was left in application/configuration files.
- Confirmed root cause: Next.js 15.5.27's `NextFontManifestPlugin` checks `request.includes('/next-font-loader/index.js?')`, but both real Windows font requests use backslashes. Both modules had the expected emitted assets and `app/layout` chunk, yet the check returned false.
- User explicitly approved **Patch Next.js**. Created a minimal persisted pnpm patch: normalize backslashes before the loader-path check, identically in CommonJS and ESM builds. Kept Next.js pinned at 15.5.27 and preserved every existing comment. Files: `patches/next@15.5.27.patch`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`. No dependency version upgrades or security-policy changes.
- Regression helper `font-preload-check.mjs` failed against the old export (`0 !== 2` expected manifest font files) and passed after the patched build. The manifest now contains the Bebas Neue and Inter Latin assets under `app/layout`; all six public pages preload each exactly once with WOFF2/CORS attributes and files present. Windows/POSIX loader-path checks also pass (not a claim of a full Linux build).
- `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `git diff --check`, `node perf-regression.mjs`, and `node font-preload-check.mjs` pass. Frozen installation confirms the persisted patch metadata is accepted. Supply-chain controls remain intact.
- Fresh home screenshots inspected at 375/390/768/1024/1440px: no introduced layout/typography defects and no horizontal overflow. Evidence: `C:/Users/gabec/AppData/Local/Temp/vqa/fontfix-home-<width>.png`.
- Re-audited every page serially with the same Lighthouse 13.5.0 default mobile simulation and local uncompressed static server. No third-party resources were excluded. The font request chain is removed; FCP improves from about 2.1s to about 1.1s on five pages. These are single samples; overall scores are mixed and the task does NOT pass.

| Page | Performance before font fix | Performance after | Accessibility | Best Practices | SEO | FCP after | LCP after |
|------|-----------------------------|-------------------|---------------|----------------|-----|-----------|-----------|
| Home | 73 | 64 | 100 | 100 | 100 | 1.15s | 5.05s |
| Services | 81 | 84 | 100 | 100 | 100 | 1.07s | 4.51s |
| Book | 77 | 64 | 96 | 77 | 100 | 2.81s | 8.07s |
| About | 79 | 85 | 100 | 100 | 100 | 1.07s | 4.34s |
| Contact | 81 | 79 | 100 | 100 | 100 | 1.07s | 5.17s |
| Shop | 81 | 84 | 100 | 100 | 100 | 1.06s | 4.45s |

- Home total blocking time increased in this sample (about 232ms → 680ms); `/book` also has a slower sample. Do not characterize this change as an overall Lighthouse score improvement. Investigate remaining main-thread/critical-resource costs with controlled repeat runs before claiming a performance regression is resolved.
- Remaining blockers: Performance ≥90 and simulated LCP <2.5s still fail; delivery lacks production compression/cache headers; Acuity cookies still cap `/book` Best Practices at 77 pending BKG-001. Existing inline booking-phone-link accessibility issue remains recorded (96 still passes PERF-001's score threshold).
- Reports: `C:/Users/gabec/AppData/Local/Temp/vqa/fontfix-<page>.json` and `fontfix-summary.json`; `<page>` = home/services/book/about/contact/shop. Previous baseline/optimized reports retained. Updated the implementation state and test-plan patch maintenance notes. PERF-001 remains BLOCKED; no second task started.

### 2026-10-14 — PERF-001 continuation: controlled delivery audit and animation lifecycle fix

- Reproduced a real OceanText scheduling bug before changing code: repeated ResizeObserver callbacks accumulated four animation-frame callbacks instead of one, going offscreen left an orphan frame, and resolving `document.fonts.ready` after unmount reattached observers. The temporary effect harness failed those three cases; reduced-motion and no-WebGL fallback cases already passed.
- Fixed only the component lifecycle: cancel the outstanding frame before resize redraws, reset the tracked frame ID, and guard observer/font callbacks after disposal. The visual shader, fonts, motion speed, design, and booking provider are unchanged; no existing comments were added/removed.
- Added a persistent regression test `apps/web/src/components/ocean-text.test.mjs`, using the existing TypeScript compiler and Node's built-in test runner/VM (no new runtime/test dependency). Five tests now pass: single loop across resizes, complete offscreen cancellation, no observer revival after unmount, no continuing loop under reduced motion, and visible text fallback without WebGL. These are deterministic lifecycle tests with stubbed browser APIs, not a GPU/browser benchmark.
- Compared the identical pre-fix static build through pinned external `serve@14.2.6` on loopback: port 8899 with `--no-compression`, port 8898 with its default gzip. `delivery-check.mjs` confirms HTTP 200, identical decompressed HTML, absent Content-Encoding on raw responses and gzip on compressed responses. No production hosting configuration or new app dependency was introduced.
- Ran three serial Lighthouse 13.5.0 default-mobile audits per delivery/page combination (Home and Services). Medians: Home raw 73 / LCP 4.764s versus gzip 82 / 2.647s; Services raw 80 / 5.238s versus gzip 98 / 2.267s. This isolates a material delivery effect; the earlier uncompressed server scores should not be treated as deployed-site measurements.
- After rebuilding the lifecycle fix, ran three serial gzip Lighthouse audits on every page, without excluding booking-provider resources. All runWarnings arrays were empty. Latest medians:

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT |
|------|-------------|---------------|----------------|-----|-----|-----|
| Home | 82 | 100 | 100 | 100 | 2.648s | 578ms |
| Services | 98 | 100 | 100 | 100 | 2.361s | 82ms |
| Book | 97 | 96 | 77 | 100 | 2.420s | 114ms |
| About | 98 | 100 | 100 | 100 | 2.358s | 78ms |
| Contact | 98 | 100 | 100 | 100 | 2.347s | 75ms |
| Shop | 98 | 100 | 100 | 100 | 2.359s | 76ms |

- Home scores varied 91/79/82 across the final runs; all three LCPs remained above 2.5s. Use the median rather than cherry-picking the 91. Home's gzip pre/post median Performance stayed 82 and LCP stayed about 2.65s; no measurable score gain is attributed to the verified lifecycle correction.
- `pnpm build`, `pnpm lint`, `node --test apps/web/src/components/ocean-text.test.mjs`, image/HTTP assertions, font-preload checks, and `git diff --check` pass. Home screenshots inspected at all five documented widths show no introduced defects and no horizontal overflow (`scrollWidth === clientWidth`). Tests and reproducible compressed/raw audit commands are documented in TEST_PLAN.
- Evidence: `C:/Users/gabec/AppData/Local/Temp/vqa/delivery-before-<mode>-<page>-<run>.json`, `delivery-summary.json`, `scheduling-gzip-<page>-<run>.json`, `scheduling-summary.json`, and `scheduling-home-<width>.png`. `<mode>` = raw/gzip; final `<page>` = home/services/book/about/contact/shop; `<run>` = 1/2/3.
- Remaining blockers: Home Performance 82/LCP 2.648s and booking Best Practices 77. Actual production gzip/Brotli and cache behavior must be validated on the eventually selected host; these compressed local runs are conditional lab evidence, not deployment verification. PERF-001 remains BLOCKED, and no second task was started.

## Next required action

Continue **PERF-001** with Home's remaining main-thread/LCP costs and the booking-provider Best Practices blocker. Preserve the design and use controlled compressed delivery with repeated runs; verify real host behavior during deployment. Do not mark COMPLETE or begin DEP-001 until all six pages pass the recorded thresholds.
