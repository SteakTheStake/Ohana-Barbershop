# Ohana Barbershop — Design System

## Brand direction

Ohana Barbershop is a welcoming, family-owned barbershop in Albany, Oregon, rooted in the owner's Hawaiian background. The design should feel:

- Warm and welcoming.
- Confident and professional.
- Relaxed rather than corporate.
- Natural and authentic.
- Modern but not trend-chasing.
- Personal rather than commercialized.

The visual language blends island motifs (waves, shark teeth, honu, hibiscus) with clean barber-shop typography and a dark, grounded palette.

## Design tokens

Colors and fonts are implemented as CSS custom properties in `apps/web/src/app/globals.css` and Tailwind v4 `@theme`.

### Color palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-ink` | `#0b0d0e` | Primary background |
| `--color-coal` | `#15191b` | Card / section backgrounds |
| `--color-lava` | `#1f2427` | Borders, dividers |
| `--color-bone` | `#ece4d6` | Primary text |
| `--color-sand` | `#c9b48f` | Secondary text, muted accents |
| `--color-reef` | `#2fa59a` | Brand teal, links, kicker text |
| `--color-ember` | `#d9692e` | CTA buttons, warm accents |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-display` | Bebas Neue, Impact, sans-serif | Headings, display text, CTAs |
| `--font-sans` | Inter, system-ui, sans-serif | Body text, labels, descriptions |

Display text uses wide letter-spacing (`tracking-wide`, `tracking-widest`). Body text uses normal to tight letter-spacing.

### Font-size scale (Tailwind utilities in use)

| Utility | Size | Usage |
|---------|------|-------|
| `text-xs` | 0.75rem | Kickers, captions, footer fine print |
| `text-sm` | 0.875rem | Blurbs, contact values, footer links |
| `text-lg` | 1.125rem | Body emphasis |
| `text-xl` | 1.25rem | Buttons, labels |
| `text-2xl` | 1.5rem | Sub-headings, header logo |
| `text-3xl` | 1.875rem | Feature titles, service names |
| `text-4xl` | 2.25rem | Prices |
| `text-5xl` | 3rem | Page titles |
| `text-6xl` | 3.75rem | Large display text |
| `text-7xl` | 4.5rem | Hero display (mobile) |
| `text-8xl` | 6rem | Hero display (desktop) |

### Spacing

Standard Tailwind spacing scale. Page content uses `max-w-4xl` (56rem) and `max-w-6xl` (72rem) containers with `px-5` horizontal padding. Section vertical spacing uses `pt-16`, `pt-20`, `pt-24`, `mt-24`.

### Border radii

- `rounded-md` for buttons.
- `rounded-xl` for cards and embed containers.
- `rounded-2xl` for large feature cards.

### Shadows

No strong shadows are used. Elevation is created through background color shifts (`bg-coal`, `bg-lava`) and borders.

### Animation

| Animation | Duration | Usage |
|-----------|----------|-------|
| `drift` | 40s linear infinite | Wave divider scroll |
| `shine` | 3.5s ease-in-out infinite | Hero "Clean Cuts" shimmer |
| `sparkle` | 3.5s ease-in-out infinite | Sparkle accents |

All animations respect `prefers-reduced-motion: reduce`.

### Breakpoints

Tailwind v4 default breakpoints are used:

| Breakpoint | Width | Notes |
|------------|-------|-------|
| `sm` | 640px | Minor layout tweaks |
| `md` | 768px | Desktop nav appears; grid layouts expand |
| `lg` | 1024px | Wide containers |
| `xl` | 1280px | Maximum content width |

### Verification viewports

Test at: 375px, 390px, 768px, 1024px, 1440px.

## Components

### Navigation (`Header`)

- Sticky top bar with translucent dark background and backdrop blur.
- Logo + wordmark on the left.
- Desktop horizontal nav (hidden below `md`).
- "Book Now" CTA button on the right.
- Mobile secondary nav row with compact links.
- Niho manō divider below the header.

### Mobile book bar (`MobileBookBar`)

- Fixed bottom bar on mobile only (`md:hidden`).
- "Call" button and "Book Now" button.
- Body padding compensates for bar height (`pb-20 md:pb-0`).

### Buttons

**Primary (`BookButton`):**
- Background `ember`, text `ink`.
- `font-display`, `text-xl`, `tracking-widest`.
- `rounded-md`, `px-6 py-3`.
- Hover: background shifts to `sand`.

**Secondary outline:**
- Border `bone/30`, text `bone`.
- Hover: border `reef`.

### Service list (`ServiceList`)

- Full-width rows with top/bottom borders.
- Service name (display font) + Hawaiian name (muted, italic) + price (teal, display font).
- Hover reveals "Book →" hint on desktop.
- Entire row is a link to `/book?service=<slug>`.

### Section title (`SectionTitle`)

- Kicker in `reef`, uppercase, wide tracking.
- Large display heading.
- Niho manō accent band.

### Patterns

- `NihoBand` — repeating shark-tooth SVG pattern.
- `WaveDivider` — animated wave SVG divider.
- `Icon` — SVG mask icons inheriting `currentColor`.

### Hero (`Home` page)

- Two-column layout on desktop: copy left, logo right.
- WebGL "Island Vibez." text effect (`OceanText`) with teal wave animation.
- "Clean Cuts." shimmer text with sparkle accents.
- CTA buttons below headline.
- Kapa texture background + gradient + wave divider.

## Page compositions

### Home `/`

1. Hero: greeting, headline, CTAs, logo.
2. Services preview: section title + service list.
3. Feature grid: Hot Towel, Keiki Friendly, Book Online.
4. Closing CTA: "Come Relax. Hang Loose." + buttons.

### Services `/services`

1. Section title.
2. Full service list.
3. "Tap a service to book" helper text.
4. "Book Now" CTA.

### Book `/book`

1. Section title (dynamic if service selected).
2. Booking iframe embed (Easy!Appointments wizard) with rounded container.
3. Fallback contact text below iframe.

### About `/about`

1. Section title.
2. Owner introduction + key facts list (From, Now, Ohana).
3. Decorative icon.
4. "Book Now" CTA.

### Contact `/contact`

1. Section title.
2. Contact action cards (Call, Text, Email, Instagram).
3. Hours & location card.

### Shop `/shop`

1. Section title.
2. "Apparel Dropping Soon" teaser card.
3. Link to Instagram for updates.

## Responsive behavior

- Navigation collapses to a compact mobile row below `md`.
- Mobile book bar appears only below `md`.
- Hero switches from stacked to two-column at `md`.
- Service list rows keep a single column on all sizes.
- Contact action grid switches to 2 columns at `sm`.
- Feature grid switches to 3 columns at `md`.

## Visual quality rules

- No clipped text.
- No horizontal scrolling caused by layout defects.
- No stretched images.
- No inconsistent button styles.
- No arbitrary spacing.
- No illegible text.
- No overlapping components.
- No confusing hierarchy.
- No mismatched icon styles.
- No unexplained empty space.
- No generic stock content presented as authentic business photography.
- No excessive animations.
- Respect `prefers-reduced-motion`.
