import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { SQLiteAdapter } from "@payloadcms/db-sqlite";

test("production boot migrates an empty database and never accepts development phone codes", { timeout: 120_000 }, async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-production-test-"));
  const password = randomBytes(24).toString("hex");
  Object.assign(process.env, {
    NODE_ENV: "production", SMS_PROVIDER: "twilio", APP_URL: "https://ohana.example",
    OWNER_APP_URL: "https://www.owner.ohana.example",
    DATABASE_URL: `file:${path.join(temp, "production.db").replace(/\\/g, "/")}`,
    PAYLOAD_SECRET: randomBytes(48).toString("hex"),
    CMS_ADMIN_EMAIL: "production-owner@ohana.local", CMS_ADMIN_PASSWORD: password,
    GOOGLE_CALENDAR_ENABLED: "true", GOOGLE_CALENDAR_ID: "production-test-calendar",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    GOOGLE_CALENDAR_NAMESPACE: "production-test-namespace",
    GOOGLE_CALENDAR_SYNC_SECRET: randomBytes(32).toString("hex"),
  });
  const { getCMS } = await import("../src/lib/cms");
  const { sendCode } = await import("../src/lib/phone-auth");
  const payload = await getCMS();
  try {
    assert.equal((await payload.count({ collection: "users" })).totalDocs, 1);
    assert.equal((await payload.count({ collection: "services" })).totalDocs, 5);
    assert.equal((await payload.findGlobal({ slug: "shop-settings" })).bookingEnabled, false);
    const owner = await payload.login({ collection: "users", data: { email: process.env.CMS_ADMIN_EMAIL!, password } });
    assert.ok(owner.token);
    assert.equal(payload.config.serverURL, process.env.OWNER_APP_URL);
    assert.deepEqual([...new Set(payload.config.csrf)], [process.env.APP_URL, process.env.OWNER_APP_URL]);
    const { NextRequest } = await import("next/server");
    const { GET: calendarHealth } = await import("../src/app/api/calendar-sync/route");
    assert.equal((await calendarHealth(new NextRequest(`${process.env.APP_URL}/api/calendar-sync`))).status, 401);
    const calendar = await calendarHealth(new NextRequest(`${process.env.APP_URL}/api/calendar-sync`, {
      headers: { authorization: `Bearer ${process.env.GOOGLE_CALENDAR_SYNC_SECRET}` },
    }));
    assert.equal(calendar.status, 503, "Live calendar readiness must remain unhealthy before its first export");
    assert.equal((await calendar.json()).state, "initializing");
    const { POST: ownerPost } = await import("../src/app/api/owner/[...path]/route");
    const ownerRequest = (origin: string) => ownerPost(new NextRequest(`${process.env.OWNER_APP_URL}/api/owner/customers/save`, {
      method: "POST", headers: { origin, cookie: `payload-token=${owner.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Owner Domain Test", phone: "+15415550999" }),
    }), { params: Promise.resolve({ path: ["customers", "save"] }) });
    assert.equal((await ownerRequest(process.env.APP_URL!)).status, 403);
    assert.equal((await ownerRequest("https://evil.example")).status, 403);
    assert.equal((await ownerRequest(process.env.OWNER_APP_URL!)).status, 200);
    assert.equal((await payload.count({ collection: "save-receipts" })).totalDocs, 0);
    assert.equal((await payload.count({ collection: "appointment-history" })).totalDocs, 0);
    const { GET: health } = await import("../src/app/api/health/route");
    const healthy = await health();
    assert.equal(healthy.status, 200);
    assert.deepEqual(await healthy.json(), { status: "ok" });
    const count = payload.count;
    payload.count = async () => { throw new Error("Private database error"); };
    try {
      const unavailable = await health();
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), { status: "unavailable" });
    } finally { payload.count = count; }
    process.env.SMS_PROVIDER = "console";
    await assert.rejects(sendCode(payload, "+15415550100"), /unavailable/);
    assert.equal((await payload.count({ collection: "phone-challenges" })).totalDocs, 0);
  } finally {
    const client = (payload.db as unknown as SQLiteAdapter).client;
    await payload.destroy();
    client.close();
    global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
