import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DateTime } from "luxon";
import { NextRequest } from "next/server";
import type { SQLiteAdapter } from "@payloadcms/db-sqlite";
import { createDemoSession, DEMO_COOKIE } from "../src/lib/demo";
import { proxy } from "../src/proxy";

test("production-built demo gates pages/APIs and edits isolated appointments without owner login", { timeout: 180_000 }, async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-demo-test-"));
  const productionFile = path.join(temp, "production-must-not-exist.db");
  Object.assign(process.env, {
    NODE_ENV: "production", DEMO_MODE: "true", DEMO_PASSWORD: "ohana26",
    DEMO_DATABASE_URL: `file:${path.join(temp, "ohana-demo.db").replace(/\\/g, "/")}`,
    DATABASE_URL: `file:${productionFile.replace(/\\/g, "/")}`,
    PAYLOAD_SECRET: randomBytes(48).toString("hex"),
    APP_URL: "https://preview.example", OWNER_APP_URL: "https://preview.example",
    SMS_PROVIDER: "disabled", GOOGLE_CALENDAR_ENABLED: "true",
    TRUST_PROXY: "false",
  });
  delete process.env.CMS_ADMIN_EMAIL;
  delete process.env.CMS_ADMIN_PASSWORD;
  const { getCMS } = await import("../src/lib/cms");
  const { GET, POST } = await import("../src/app/api/owner/[...path]/route");
  const { POST: unlock } = await import("../src/app/api/demo/route");
  const { POST: lock } = await import("../src/app/api/demo/logout/route");
  const { sendCode, checkCode } = await import("../src/lib/phone-auth");
  const { googleCalendarConfig } = await import("../src/lib/google-calendar");
  const payload = await getCMS();
  const cookie = `${DEMO_COOKIE}=${createDemoSession()}`;
  const request = (url: string, data?: unknown, auth = cookie, origin = process.env.APP_URL!) => {
    const req = new NextRequest(`${process.env.APP_URL}/api/owner/${url}`, {
      method: data === undefined ? "GET" : "POST",
      headers: { cookie: auth, origin, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return (data === undefined ? GET : POST)(req, { params: Promise.resolve({ path: url.split("?")[0].split("/") }) });
  };
  try {
    for (const url of ["/", "/owner", "/about", "/admin/collections/customers"]) {
      const response = proxy(new NextRequest(`${process.env.APP_URL}${url}`));
      assert.equal(response.status, 307);
      assert.equal(new URL(response.headers.get("location")!).pathname, "/demo");
      assert.match(response.headers.get("cache-control")!, /no-store/);
    }
    for (const url of ["/api/owner/customers", "/api/customers", "/api/ohana/catalog", "/api/graphql"]) {
      assert.equal(proxy(new NextRequest(`${process.env.APP_URL}${url}`)).status, 401);
    }
    assert.equal(proxy(new NextRequest(`${process.env.APP_URL}/demo`)).status, 200);
    assert.equal(proxy(new NextRequest(`${process.env.APP_URL}/api/health`)).status, 200);
    assert.equal(proxy(new NextRequest(`${process.env.APP_URL}/_next/static/test.css`)).status, 200);
    const admin = proxy(new NextRequest(`${process.env.APP_URL}/admin/collections/customers`, { headers: { cookie } }));
    assert.equal(new URL(admin.headers.get("location")!).pathname, "/owner");
    assert.equal(proxy(new NextRequest(`${process.env.APP_URL}/owner`, { headers: { cookie } })).status, 200);
    assert.equal((await request("session", undefined, "")).status, 401);
    assert.equal((await request("session", undefined, `${DEMO_COOKIE}=forged`)).status, 401);
    const session = await (await request("session")).json();
    assert.equal(session.demo, true);
    assert.equal(session.owner.name, "Spencer (demo)");
    assert.equal((await request("customers/save", { name: "Nope", phone: "5415550101" }, cookie, "https://evil.example")).status, 403);
    const customerResult = await request("customers/save", { name: "Fictional Demo Customer", phone: "5415550101" });
    assert.equal(customerResult.status, 200);
    const customer = (await customerResult.json()).customer;
    const service = (await payload.find({ collection: "services", limit: 1 })).docs[0];
    let date = DateTime.now().setZone("America/Los_Angeles").plus({ days: 2 });
    if (date.weekday === 7) date = date.plus({ days: 1 });
    const day = date.toISODate()!;
    const slots = (await (await request(`availability?service=${service.id}&date=${day}`)).json()).slots;
    assert.ok(slots.length > 2);
    const visitResult = await request("appointments/save", {
      requestId: randomUUID(), customerId: customer.id, serviceId: service.id, startsAt: slots[0], notes: "Demo cut",
    });
    assert.equal(visitResult.status, 200, JSON.stringify(await visitResult.clone().json()));
    const visit = (await visitResult.json()).appointment;
    const edited = await request("appointments/save", {
      requestId: randomUUID(), id: visit.id, revision: visit.revision, customerId: customer.id,
      serviceId: service.id, startsAt: slots[1], notes: "Updated demo cut",
    });
    assert.equal(edited.status, 200, JSON.stringify(await edited.clone().json()));
    const saved = (await (await request(`day?date=${day}`)).json()).appointments[0];
    assert.equal(saved.notes, "Updated demo cut");
    assert.equal(saved.startsAt, slots[1]);
    assert.equal(googleCalendarConfig(), null, "demo must disable Google even when configured on");
    await assert.rejects(sendCode(payload, "+15415550101"), /disabled in this demo/);
    await assert.rejects(checkCode(payload, 1, "123456", "Demo"), /disabled in this demo/);
    await assert.rejects(access(productionFile), /ENOENT/);
    const loginRequest = (password: string, origin = process.env.APP_URL!) => new NextRequest(`${process.env.APP_URL}/api/demo`, {
      method: "POST", headers: { origin, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password, next: "/owner" }).toString(),
    });
    assert.equal((await unlock(loginRequest("ohana26", "https://evil.example"))).status, 403);
    const wrong = await unlock(loginRequest("wrong"));
    assert.match(wrong.headers.get("location")!, /error=password/);
    assert.equal(wrong.cookies.get(DEMO_COOKIE), undefined);
    const accepted = await unlock(loginRequest("ohana26"));
    assert.equal(accepted.status, 303);
    assert.equal(new URL(accepted.headers.get("location")!).pathname, "/owner");
    assert.ok(accepted.cookies.get(DEMO_COOKIE)?.value);
    assert.match(accepted.headers.get("set-cookie")!, /HttpOnly/i);
    assert.match(accepted.headers.get("set-cookie")!, /Secure/i);
    const locked = await lock(new NextRequest(`${process.env.APP_URL}/api/demo/logout`, { method: "POST", headers: { origin: process.env.APP_URL! } }));
    assert.equal(locked.cookies.get(DEMO_COOKIE)?.value, "");
    for (let i = 0; i < 8; i++) await unlock(loginRequest("wrong"));
    assert.match((await unlock(loginRequest("ohana26"))).headers.get("location")!, /error=limited/);
    process.env.DEMO_MODE = "false";
    assert.equal((await request("session")).status, 401, "demo cookie must not bypass real owner auth");
    assert.equal((await unlock(loginRequest("ohana26"))).status, 404);
  } finally {
    const client = (payload.db as unknown as SQLiteAdapter).client;
    await payload.destroy();
    client.close();
    global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
