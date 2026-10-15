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
| Load `/book` | Acuity iframe loads; page title is "Book". |
| Load `/book?service=skin-fade` | Page title includes "Skin Fade"; iframe points to appointment-type URL when `acuityTypeId` is configured. |
| If Acuity fails to load | Fallback contact text with phone link is visible. |

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
| Acuity iframe | Height/content changes can cause scroll bars or whitespace. | Visual inspection after Acuity URL updates. |
| Mobile book bar | May overlap content or hide footer links. | Check `pb-20` body padding on all pages. |

## Tests not in scope

- End-to-end booking flow inside Acuity (handled by Acuity).
- Payment processing (no checkout in this phase).
- User authentication (no accounts).
- Server API tests (no backend).
