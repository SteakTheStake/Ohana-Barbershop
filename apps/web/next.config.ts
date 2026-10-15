import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { NextConfig } from "next";

// `output: "export"` breaks `next dev` (missing manifests / 500s), so only
// apply it to production builds. Static export still runs on `pnpm build`.
// Dev uses a separate distDir so `next dev` and `next build` can run
// concurrently without corrupting each other's `.next` cache.
const nextConfig = (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  output: phase === PHASE_DEVELOPMENT_SERVER ? undefined : "export",
  images: {
    unoptimized: true,
  },
});

export default nextConfig;
