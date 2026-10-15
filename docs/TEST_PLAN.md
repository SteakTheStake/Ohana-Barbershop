# Ohana Barbershop — Test Plan

## Testing strategy

The project is a static marketing site with minimal interactive logic. Tests focus on build correctness, linting, type checking, manual functional verification, responsive layout, accessibility, and visual quality. There are no unit or integration tests in this phase unless explicitly added for a complex component.

## Required checks before any deployment

1. `pnpm install` passes.
2. `pnpm lint` passes with no errors.
3. `pnpm build` passes with no errors.
4. `next build` output contains all expected static routes.
5. No TypeScript errors are reported during build.

## Automated checks

| Command | What it verifies | Must pass? |
|---------|------------------|------------|
| `pnpm install` | Dependencies are installable | Yes |
| `pnpm lint` | ESLint rules | Yes |
| `pnpm build` | TypeScript, Next.js build, static generation | Yes |

## Manual functional tests

### Navigation

| Step | Expected result |
|------|-----------------|
| Load `/` | Home page renders with hero, services, CTAs. |
| Click "Services" | Navigate to `/services`. |
| Click "About" | Navigate to `/about`. |
| Click "Shop" | Navigate to `/shop`. |
| Click "Contact" | Navigate to `/contact`. |
| Click "Book Now" | Navigate to `/book`. |
| Click a service row on `/services` | Navigate to `/book?service=<slug>`. |
| Click logo | Return to `/`. |

### Booking page

| Step | Expected result |
|------|-----------------|
| Load `/book` | Easy!Appointments booking wizard iframe loads; page title is "Book". |
| Load `/book?service=skin-fade` | Page title includes "Skin Fade"; booking wizard preselects the matching service **if** E!A honors a deep-link parameter (verify during BKG-001). |
| If the booking server fails to load | Fallback contact text with phone link is visible. |

### Contact page

| Step | Expected result |
|------|-----------------|
| Click Call | Device initiates phone call to `(458) 309-8765`. |
| Click Text | Device opens SMS to `(458) 309-8765`. |
| Click Email | Device opens email to `ohanabarbershop1@gmail.com`. |
| Click Instagram | Opens `https://instagram.com/ohana_barber541` in new tab. |

### Shop page

| Step | Expected result |
|------|-----------------|
| Load `/shop` | "Apparel Dropping Soon" card renders. |
| Click Instagram link | Opens Instagram in new tab. |

## Responsive tests

Test each page at the following viewport widths: 375px, 390px, 768px, 1024px, 1440px.

| Viewport | Checks |
|----------|--------|
| 375px | No horizontal scroll; text readable; mobile book bar visible; nav row usable; CTA buttons large enough to tap. |
| 390px | Same as 375px, common iPhone width. |
| 768px | Desktop nav appears; mobile book bar hidden; hero switches to two columns; feature grid becomes 3 columns. |
| 1024px | Layouts breathe; no cramped sections; consistent spacing. |
| 1440px | Max-width containers centered; no excessive whitespace. |

## Accessibility tests (WCAG 2.2 AA target)

| Check | How to verify |
|-------|---------------|
| Keyboard navigation | Tab through each page; all interactive elements reachable and operable. |
| Focus visibility | Focus indicator visible on links and buttons. |
| Heading hierarchy | `h1` → `h2` → `h3` order is logical. |
| Alt text | Logo and meaningful images have descriptive `alt` attributes; decorative icons use `aria-hidden`. |
| Color contrast | Body text on `ink` background (`#ece4d6` on `#0b0d0e`) passes AA. CTA text on `ember` background passes AA. |
| Link purpose | Link text describes destination; no "click here". |
| Reduced motion | Animations stop when `prefers-reduced-motion: reduce` is set. |
| Form labels | Any added form inputs have associated `<label>` elements. |

## SEO tests

| Check | How to verify |
|-------|---------------|
| Page titles | Each page has a unique `<title>`. |
| Meta description | Each page has a relevant `<meta name="description">`. |
| Open Graph | `/logo.webp` referenced; `og:title` and `og:description` present. |
| JSON-LD | BarberShop schema present on home page; includes address, phone, email, services. |
| Sitemap | `/sitemap.xml` returns valid XML with all public routes. |
| Canonical URL | `metadataBase` set to `site.url`. |

## Performance tests

| Check | Target |
|-------|--------|
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 90 |
| Lighthouse Best Practices | ≥ 90 |
| Lighthouse SEO | ≥ 95 |
| First Contentful Paint | < 1.5s on 4G simulation |
| Largest Contentful Paint | < 2.5s on 4G simulation |

### Lighthouse reproduction (PERF-001)

1. Run `pnpm build`. Because this project uses static export, audit the exported files instead of `pnpm start` (which invokes unsupported `next start` for this mode).
2. From outside `apps/web/out`, serve it with `python -m http.server 8899 --bind 127.0.0.1 --directory "E:/devwork/Ohana-Barbershop/apps/web/out"`. Keeping the server's working directory outside `out` avoids the Windows directory lock encountered during rebuilds. Stop the audit server before rebuilding.
3. In an existing temporary report directory, run `pnpm dlx lighthouse@13.5.0 http://127.0.0.1:8899/ --chrome-flags="--headless=new" --output=json --output-path=home.json`. This is a pinned, external audit tool, not an application dependency. On Windows, set `CHROME_PATH` to the installed Chrome executable if auto-discovery fails.
4. Repeat for `/services.html`, `/book.html`, `/about.html`, `/contact.html`, and `/shop.html`, using separate report filenames. Defaults use mobile emulation and simulated throttling. Do not exclude booking-provider requests to make scores pass. Repeat serially when comparing timings; individual samples vary.
5. Record category scores, simulated LCP, run warnings, and failed audit IDs. A local server without compression/cache headers is not equivalent to the final production host; re-audit the chosen host at deployment. Never claim completion if measured thresholds fail.

### Controlled delivery and animation regression checks

- Run `node --test apps/web/src/components/ocean-text.test.mjs` from the repository root using Node 22+ (the workstation uses Node 26). The test uses existing TypeScript plus Node's built-in test/VM facilities to execute the effect with deterministic browser/WebGL stubs. It guards against duplicate requestAnimationFrame loops across resize, orphan offscreen frames, observers reattached after unmount, reduced-motion loops, and loss of the no-WebGL DOM fallback. It is not an end-to-end GPU benchmark.
- For compressed local delivery, from outside `out` run `pnpm dlx serve@14.2.6 "E:/devwork/Ohana-Barbershop/apps/web/out" --listen tcp://127.0.0.1:8898 --no-clipboard --no-request-logging --no-port-switching`. The pinned tool is external to the app. For the same-server raw comparison, use port 8899 and add `--no-compression`. Stop both servers before rebuilding.
- Confirm `Content-Encoding: gzip` when requesting compressible assets/HTML with `Accept-Encoding: gzip`, and verify raw/gzip responses decode to identical content. Do not assume compression merely because a server advertises it. Neither server represents verified production hosting.
- Audit clean routes (`/`, `/services`, `/book`, `/about`, `/contact`, `/shop`) on the gzip server using the Lighthouse command above with port 8898. Keep mobile/default simulated throttling, no blocked third-party resources, and run at least three samples serially. Report medians and ranges, including failures, not the highest score. Changing delivery or throttling must be explicitly identified when comparing earlier reports.
- Local comparison/evidence helpers: `C:/Users/gabec/AppData/Local/Temp/vqa/delivery-check.mjs`, `delivery-summary.json`, and `scheduling-summary.json`. The gzip/raw comparison demonstrates transfer effects, not an application-code speedup; final deployed-host compression/cache headers require separate validation.

### Next.js Windows font-preload patch

- `patches/next@15.5.27.patch` fixes a confirmed Windows path-separator bug in the CommonJS/ESM font-manifest plugin. The patch normalizes separators only for the loader-path match; it does not change fonts, versions, or runtime scheduling behavior. `pnpm-workspace.yaml` registers it and the lockfile records its hash.
- Use `pnpm install --frozen-lockfile` to apply/validate the patch, then `pnpm build` and `pnpm lint`. Never manually edit the installed package as a substitute for updating the persisted patch.
- Verify `.next/server/next-font-manifest.json` contains the layout's two Latin font assets. Each public exported page must contain two unique `rel="preload" as="font"` links with WOFF2 type and CORS attributes, and each referenced file must exist in `out/_next/static/media`. Do not hard-code generated font hashes in source.
- Regression helper and evidence for this workstation: `C:/Users/gabec/AppData/Local/Temp/vqa/font-preload-check.mjs` (failed before patch; passed after), `fontfix-<page>.json`, and `fontfix-summary.json`. The helper checks the manifest, all six exported pages, and Windows/POSIX loader-path matching.
- When upgrading Next.js, re-evaluate whether upstream handles both separators. Remove or rebase the patch deliberately with pnpm, regenerate the lockfile normally, and repeat the preload assertions and Lighthouse audits. A passing preload check alone does not establish passing Lighthouse Performance/LCP scores.

## Visual tests

| Page | What to inspect |
|------|-----------------|
| Home | Hero balance, logo sizing, shimmer animation, service list spacing, feature grid, footer. |
| Services | Service list readability, price alignment, CTA prominence. |
| Book | Iframe height, rounded container, fallback text. |
| About | Fact list alignment, decorative icon, CTA. |
| Contact | Action card grid, hours card, icon placement. |
| Shop | Teaser card centered, typography hierarchy. |

## Regression risks

| Area | Risk | Mitigation |
|------|------|------------|
| Tailwind v4 config | Breaking changes between v3 and v4 utilities. | Verify build after any utility change. |
| WebGL hero (`OceanText`) | Fails on older GPUs or when WebGL disabled. | Component renders fallback text if WebGL fails. |
| Booking iframe | Height/content changes can cause scroll bars or whitespace; E!A wizard is third-party UI we do not control. | Visual inspection after `NEXT_PUBLIC_BOOKING_URL` updates; keep fallback contact text visible. |
| Mobile book bar | May overlap content or hide footer links. | Check `pb-20` body padding on all pages. |

## Tests not in scope

- End-to-end booking flow inside Easy!Appointments (handled by E!A; smoke-test manually after the instance is deployed).
- Payment processing (no checkout in this phase).
- User authentication (no accounts).
- Server API tests (no backend).
