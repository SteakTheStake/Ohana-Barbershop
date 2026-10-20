import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

// Booking and the CMS need a Node runtime. Isolate dev and build caches.
const nextConfig = (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? process.env.OHANA_DEV_DIST_DIR ?? ".next-dev" : ".next",
  async redirects() {
    return [{ source: "/admin", destination: "/owner", permanent: false }];
  },
  images: {
    unoptimized: true,
  },
});

const config = (phase: string) => withPayload(nextConfig(phase));
export default config;
