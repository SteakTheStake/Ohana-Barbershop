# Ohana Barbershop — Deployment

## Local setup

### Prerequisites

- Node.js 20 or later (LTS recommended)
- pnpm 8 or later (`corepack` or `npm install -g pnpm`)
- Git

### Install dependencies

```bash
pnpm install
```

### Development server

```bash
pnpm dev
```

Runs `next dev` in `apps/web`. Site available at `http://localhost:3000`.

### Build for production

```bash
pnpm build
```

Runs `next build` in `apps/web`. Static export produces an `apps/web/out/` directory (after `distDir: 'out'` is configured).

### Lint

```bash
pnpm lint
```

## Required environment variables

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_ACUITY_URL` | Owner's Acuity Scheduling base URL | No — falls back to placeholder |

Set in `.env.local` for local development or in the host's environment settings for production.

## Build configuration

`apps/web/next.config.ts` should include:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

This enables static HTML export without image optimization (required for hosts that do not run the Next.js image server).

## Preview / staging deployment

1. Push changes to a branch.
2. Build the site: `pnpm build`.
3. Deploy the output directory (`dist/` or `out/`) to a staging URL.
4. Run manual checks from the Test Plan.

## Production deployment process

1. Ensure all tests pass locally:
   ```bash
   pnpm lint
   pnpm build
   ```
2. Merge changes to the production branch.
3. Host builds and deploys automatically (CI/CD) or manually upload the output directory.
4. Verify production URL loads, HTTPS is active, and domain resolves.

## Domain configuration

- Target domain: `ohana-barbershop.com`
- DNS A/AAAA or CNAME records must point to the chosen host.
- Enable HTTPS at the host.
- Set the canonical URL in `apps/web/src/lib/site.ts` (`site.url`).

## Email preservation

The business email (`ohanabarbershop1@gmail.com`) is managed by Google Workspace / Gmail. Deployment of the website does not affect email. Do not modify MX records unless explicitly migrating email providers.

## Backup strategy

- Source code: backed up by Git (GitHub / GitLab / etc.).
- Static assets: stored in the repository `public/` directory and backed up by Git.
- Acuity data: retained by Acuity Scheduling; not stored on the website.

## Rollback procedure

1. Revert the last commit or deploy the previous known-good build.
2. Re-run `pnpm build`.
3. Redeploy the output directory.
4. Verify the production site loads correctly.

## Post-deployment verification

- [ ] All public routes return 200.
- [ ] `/sitemap.xml` is valid.
- [ ] JSON-LD is present on the home page.
- [ ] Acuity iframe loads on `/book`.
- [ ] Phone/email/social links work on `/contact`.
- [ ] No console errors on any page.
- [ ] Mobile and desktop layouts look correct.
