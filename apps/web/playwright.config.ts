import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PLAYWRIGHT_PORT must be a valid port.");
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined),
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "tablet", use: { viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`, url: `${baseURL}/api/ohana/catalog`,
    env: { OHANA_DEV_DIST_DIR: ".next-dev/playwright" },
    reuseExistingServer: true, timeout: 120_000,
  },
});
