import { createHmac, timingSafeEqual } from "node:crypto";

export const demoEnabled = () => process.env.DEMO_MODE === "true";
export const DEMO_COOKIE = "ohana-demo";
export const DEMO_SECONDS = 12 * 60 * 60;

function signature(value: string) {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret || secret.length < 32) throw new Error("Demo access requires a 32+ character PAYLOAD_SECRET.");
  return createHmac("sha256", secret).update(`ohana-demo:${value}`).digest("hex");
}

function equal(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function demoPasswordMatches(password: string) {
  return demoEnabled() && equal(password, process.env.DEMO_PASSWORD ?? "spencerohana");
}

export function createDemoSession(now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + DEMO_SECONDS);
  return `${expires}.${signature(expires)}`;
}

export function validDemoSession(token: string | undefined, now = Date.now()) {
  if (!demoEnabled() || !token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, mac] = token.split(".");
  const remaining = Number(expires) - Math.floor(now / 1000);
  return remaining > 0 && remaining <= DEMO_SECONDS && equal(mac, signature(expires));
}

export function demoReturnPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") &&
    !/[\\\r\n\t]/.test(value) && !value.startsWith("/demo") && !value.startsWith("/api/")
    ? value : "/";
}

export function demoDatabaseURL() {
  const url = process.env.DEMO_DATABASE_URL ?? "file:./ohana-demo.db";
  // Demo mode must never fall back to DATABASE_URL or a remote database.
  if (!/^file:(?:.*[/\\])?ohana-demo\.db$/.test(url) || /[?#]/.test(url)) {
    throw new Error("DEMO_DATABASE_URL must be a local file named ohana-demo.db.");
  }
  return url;
}
