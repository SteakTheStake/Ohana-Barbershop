import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DateTime } from "luxon";
import { NextRequest } from "next/server";
import type { SQLiteAdapter } from "@payloadcms/db-sqlite";

test("owner workspace permissions and real shop workflows", { timeout: 180_000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-owner-test-"));
  Object.assign(process.env, {
    NODE_ENV: "test", DATABASE_URL: `file:${path.join(temp, "owner.db").replace(/\\/g, "/")}`,
    PAYLOAD_SECRET: randomBytes(48).toString("hex"), CMS_ADMIN_EMAIL: "owner@ohana.test",
    CMS_ADMIN_PASSWORD: randomBytes(24).toString("hex"), SMS_PROVIDER: "console",
    APP_URL: "http://localhost:3000", TRUST_PROXY: "false",
    GOOGLE_CALENDAR_ENABLED: "false",
  });
  const { getCMS } = await import("../src/lib/cms");
  const { readAvailability } = await import("../src/lib/booking-data");
  const { GET, POST } = await import("../src/app/api/owner/[...path]/route");
  const payload = await getCMS();
  const login = await payload.login({ collection: "users", data: { email: process.env.CMS_ADMIN_EMAIL!, password: process.env.CMS_ADMIN_PASSWORD! } });
  const cookie = `payload-token=${login.token}`;
  async function request(route: string, data?: unknown, auth = cookie, origin = "http://localhost:3000") {
    if (data && ["appointments/save", "appointments/status"].includes(route)) {
      const fields = data as Record<string, unknown>;
      const revision = fields.id && !("revision" in fields)
        ? (await payload.findByID({ collection: "appointments", id: Number(fields.id), depth: 0 })).revision : fields.revision;
      data = { requestId: randomUUID(), ...fields, ...(revision === undefined ? {} : { revision }) };
    }
    const req = new NextRequest(`http://localhost:3000/api/owner/${route}`, {
      method: data === undefined ? "GET" : "POST", headers: { cookie: auth, origin, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return (data === undefined ? GET : POST)(req, { params: Promise.resolve({ path: route.split("?")[0].split("/") }) });
  }
  const day = DateTime.now().setZone("America/Los_Angeles").plus({ days: 3 }).toISODate()!;
  let serviceId = 0;
  let visitId = 0;
  let customerId = 0;
  let start = "";
  try {
    await t.test("anonymous and customer cookies cannot read or change the owner workspace", async () => {
      for (const auth of ["", "ohana-customer=untrusted", "payload-token=forged"]) {
        assert.equal((await request("session", undefined, auth)).status, 401);
        assert.equal((await request(`day?date=${day}`, undefined, auth)).status, 401);
        assert.equal((await request("calendar", undefined, auth)).status, 401);
        assert.equal((await request("calendar/google", undefined, auth)).status, 401);
        assert.equal((await request("calendar/google/sync", {}, auth)).status, 401);
        assert.equal((await request("customers/save", { name: "Unauthorized", phone: "5415550300" }, auth)).status, 401);
        assert.equal((await request("calendar/reset", {}, auth)).status, 401);
      }
      assert.equal((await payload.count({ collection: "customers" })).totalDocs, 0);
    });
    await t.test("owner sessions authenticate with Payload and mutations enforce Origin", async () => {
      const session = await request("session");
      assert.equal(session.status, 200);
      assert.equal((await session.json()).owner.email, process.env.CMS_ADMIN_EMAIL);
      assert.equal((await request("customers/save", { name: "Nope", phone: "5415550300" }, cookie, "https://evil.test")).status, 403);
    });
    await t.test("owner can work with public booking off and bypass public lead time and horizon", async () => {
      const hours = Array.from({ length: 7 }, (_, n) => ({ weekday: String(n), closed: false, opens: "00:00", closes: "23:59" }));
      const result = await request("settings", { bookingEnabled: false, announcement: "Call us", leadMinutes: 10080, bookingDays: 1, cancellationHours: 168, weeklyHours: hours });
      assert.equal(result.status, 200, JSON.stringify(await result.clone().json()));
      const services = await payload.find({ collection: "services", limit: 1 });
      const service = services.docs[0];
      serviceId = service.id;
      assert.deepEqual(await readAvailability(payload, service, day), []);
      const available = await request(`availability?service=${service.id}&date=${day}`);
      assert.equal(available.status, 200);
      const slots = (await available.json()).slots;
      assert.ok(slots.length > 0);
      start = slots[20];
    });
    await t.test("booking a new customer and their visit commits together with trusted prices", async () => {
      const result = await request("appointments/save", { serviceId, startsAt: start, notes: "Usual cut", priceCents: 1, newCustomer: { name: "Aloha Customer", phone: "(541) 555-0300" } });
      assert.equal(result.status, 200, JSON.stringify(await result.clone().json()));
      const visit = (await result.json()).appointment;
      visitId = visit.id; customerId = visit.customer.id;
      assert.equal(visit.customer.phone, "+15415550300");
      assert.ok(visit.priceCents > 1);
      const conflict = await request("appointments/save", { serviceId, startsAt: start, newCustomer: { name: "Do Not Leave Behind", phone: "5415550301" } });
      assert.equal(conflict.status, 409);
      assert.equal((await payload.count({ collection: "customers" })).totalDocs, 1, "a failed booking must roll back the new contact too");
    });
    await t.test("owner sees a useful daily schedule and can change notes, time and status", async () => {
      const schedule = await (await request(`day?date=${day}`)).json();
      assert.equal(schedule.appointments[0].customer.name, "Aloha Customer");
      assert.equal(schedule.appointments[0].notes, "Usual cut");
      assert.equal(schedule.settings.bookingEnabled, false);
      assert.ok(!JSON.stringify(schedule).includes("tokenHash"));
      const slots = (await (await request(`availability?service=${serviceId}&date=${day}&appointment=${visitId}`)).json()).slots;
      assert.ok(slots.includes(start), "the current visit must not block its own editing choices");
      const updatedStart = slots[24];
      const updated = await request("appointments/save", { id: visitId, serviceId, customerId, startsAt: updatedStart, notes: "Shorter on the sides" });
      assert.equal(updated.status, 200);
      start = updatedStart;
      assert.equal((await request("appointments/status", { id: visitId, status: "completed" })).status, 200);
      assert.equal((await request("appointments/status", { id: visitId, status: "confirmed" })).status, 200);
      assert.equal((await request("appointments/status", { id: visitId, status: "invented" })).status, 400);
    });
    await t.test("customer editing normalizes phone numbers and revokes old phone sessions", async () => {
      await payload.create({ collection: "customer-sessions", data: { tokenHash: randomBytes(32).toString("hex"), customer: customerId, expiresAt: new Date(Date.now() + 86400_000).toISOString() } });
      const result = await request("customers/save", { id: customerId, name: "Aloha Updated", phone: "(541) 555-0302", preferences: "Private: number 2 guard" });
      assert.equal(result.status, 200, JSON.stringify(await result.clone().json()));
      assert.equal((await result.json()).customer.phone, "+15415550302");
      assert.equal((await payload.count({ collection: "customer-sessions" })).totalDocs, 0);
      const found = await (await request("customers?q=5550302")).json();
      assert.equal(found.customers[0].name, "Aloha Updated");
      assert.equal(found.customers[0].preferences, "Private: number 2 guard");
    });
    await t.test("duplicate contacts give a useful error instead of creating a second account", async () => {
      const duplicate = await request("customers/save", { name: "Duplicate", phone: "5415550302" });
      assert.equal(duplicate.status, 400);
      assert.match((await duplicate.json()).error, /already belongs/);
      const duplicateBooking = await request("appointments/save", { serviceId, startsAt: start, newCustomer: { name: "Duplicate", phone: "5415550302" } });
      assert.equal(duplicateBooking.status, 409);
      assert.match((await duplicateBooking.json()).error, /Find customer/);
    });
    await t.test("the private calendar feed mirrors confirmed visits for Google Calendar", async () => {
      const { GET: feed } = await import("../src/app/api/calendar/[token]/route");
      const link = await (await request("calendar")).json();
      assert.match(link.url, /^http:\/\/localhost:3000\/api\/calendar\/[0-9a-f]{64}$/);
      const token = link.url.split("/").pop()!;
      const open = (key: string) => feed(new NextRequest(`http://localhost:3000/api/calendar/${key}`), { params: Promise.resolve({ token: key }) });
      assert.equal((await open("0".repeat(64))).status, 404);
      assert.equal((await open("leaked")).status, 404);
      const blockStart = DateTime.fromISO(start).plus({ hours: 4 }).toUTC().toISO()!;
      const block = await request("time-off/save", { reason: "Lunch, errands", startsAt: blockStart, endsAt: DateTime.fromISO(blockStart).plus({ minutes: 45 }).toISO() });
      assert.equal(block.status, 200);
      const blockId = (await block.json()).block.id;
      try {
        const serviceName = (await payload.findByID({ collection: "services", id: serviceId, depth: 0 })).name;
        const response = await open(token);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /text\/calendar/);
        const ics = (await response.text()).replace(/\r\n /g, "");
        assert.match(ics, /BEGIN:VCALENDAR\r\n/);
        assert.match(ics, /X-WR-CALNAME:Ohana Barbershop/);
        assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT1H/);
        assert.match(ics, new RegExp(`UID:visit-${visitId}@ohana-shop`));
        assert.match(ics, new RegExp(`SUMMARY:${serviceName} — Aloha Updated`));
        assert.match(ics, /DESCRIPTION:Visit status: confirmed\\nCustomer: Aloha Updated\\nPhone: \+15415550302/);
        assert.match(ics, /LOCATION:820 Pacific Blvd SE Ste F\\, Albany\\, OR 97322/);
        assert.match(ics, new RegExp(`UID:block-${blockId}@ohana-shop`));
        assert.match(ics, /SUMMARY:Time off — Lunch\\, errands/);
        await request("appointments/status", { id: visitId, status: "cancelled" });
        const after = await (await open(token)).text();
        assert.ok(!after.includes(`visit-${visitId}@`), "cancelled visits must leave the feed");
        const rotated = await (await request("calendar/reset", {})).json();
        assert.notEqual(rotated.url, link.url);
        assert.equal((await open(token)).status, 404);
        assert.equal((await open(rotated.url.split("/").pop()!)).status, 200);
      } finally {
        await request("appointments/status", { id: visitId, status: "confirmed" });
        await request("time-off/remove", { id: blockId });
      }
    });
    await t.test("retries commit one booking, receipt and history entry; stale edits cannot overwrite", async () => {
      const slots = (await (await request(`availability?service=${serviceId}&date=${day}`)).json()).slots;
      const fields = { requestId: randomUUID(), serviceId, customerId, startsAt: slots[0], notes: "Retry-safe" };
      const before = (await payload.count({ collection: "appointment-history" })).totalDocs;
      const responses = await Promise.all([request("appointments/save", fields), request("appointments/save", fields)]);
      assert.deepEqual(responses.map((r) => r.status), [200, 200]);
      const first = (await responses[0].json()).appointment;
      assert.deepEqual((await responses[1].json()).appointment, first);
      assert.equal((await payload.count({ collection: "appointment-history" })).totalDocs, before + 1);
      assert.equal((await request("appointments/save", { ...fields, notes: "Different intent" })).status, 409);
      const update = { requestId: randomUUID(), id: first.id, serviceId, customerId, startsAt: first.startsAt, notes: "New notes", revision: first.revision };
      assert.equal((await request("appointments/save", update)).status, 200);
      assert.equal((await request("appointments/save", update)).status, 200, "replay works despite old revision");
      assert.equal((await request("appointments/save", { ...update, requestId: randomUUID(), notes: "Stale overwrite" })).status, 409);
      assert.equal((await request("appointments/status", { id: first.id, revision: first.revision, status: "cancelled" })).status, 409);
      assert.equal((await request("appointments/save", { ...update, requestId: randomUUID(), revision: undefined })).status, 409);
      const history = await (await request(`appointments/history?id=${first.id}`)).json();
      assert.equal(history.history.length, 2);
      assert.ok(history.history.every((entry: { actor: string }) => entry.actor.startsWith("Owner #")));
      assert.ok(!JSON.stringify(history).includes("New notes"), "history excludes notes and phones");
      const concurrent = await Promise.all([
        request("appointments/status", { id: first.id, revision: first.revision + 1, status: "completed" }),
        request("appointments/status", { id: first.id, revision: first.revision + 1, status: "no-show" }),
      ]);
      assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
      assert.equal((await request(`appointments/history?id=${first.id}`, undefined, "")).status, 401);
      await assert.rejects(payload.find({ collection: "save-receipts", overrideAccess: false }));
      await assert.rejects(payload.find({ collection: "appointment-history", overrideAccess: false }));
      const receipts = (await payload.count({ collection: "save-receipts" })).totalDocs;
      const rejected = { requestId: randomUUID(), serviceId, customerId, startsAt: first.startsAt };
      assert.equal((await request("appointments/save", rejected)).status, 409);
      assert.equal((await payload.count({ collection: "save-receipts" })).totalDocs, receipts, "failed writes leave no receipt");
      await request("appointments/status", { id: first.id, status: "cancelled" });
    });
    await t.test("history failures roll back the visit, new customer, locks and receipt", async () => {
      const slots = (await (await request(`availability?service=${serviceId}&date=${day}`)).json()).slots;
      const fields = {
        requestId: randomUUID(), serviceId, startsAt: slots[0],
        newCustomer: { name: "Atomic history test", phone: "5415550310" },
      };
      const before = await Promise.all((["appointments", "customers", "occupancy", "save-receipts", "appointment-history"] as const)
        .map(async (collection) => (await payload.count({ collection })).totalDocs));
      const config = payload.collections["appointment-history"].config;
      const original = config.hooks.beforeChange;
      config.hooks.beforeChange = [() => { throw new Error("Simulated audit storage failure"); }];
      try { assert.equal((await request("appointments/save", fields)).status, 503); }
      finally { config.hooks.beforeChange = original; }
      const after = await Promise.all((["appointments", "customers", "occupancy", "save-receipts", "appointment-history"] as const)
        .map(async (collection) => (await payload.count({ collection })).totalDocs));
      assert.deepEqual(after, before);
      const retry = await request("appointments/save", fields);
      assert.equal(retry.status, 200);
      await request("appointments/status", { id: (await retry.json()).appointment.id, status: "cancelled" });
    });
    await t.test("breaks cannot silently displace appointments; cancelling opens the time", async () => {
      const end = DateTime.fromISO(start).plus({ minutes: 30 }).toUTC().toISO()!;
      assert.equal((await request("time-off/save", { reason: "Lunch", startsAt: start, endsAt: end })).status, 409);
      assert.equal((await payload.count({ collection: "time-off" })).totalDocs, 0);
      assert.equal((await request("appointments/status", { id: visitId, status: "cancelled" })).status, 200);
      const saved = await request("time-off/save", { reason: "Lunch", startsAt: start, endsAt: end });
      assert.equal(saved.status, 200);
      const block = (await saved.json()).block;
      assert.ok(!(await (await request(`availability?service=${serviceId}&date=${day}`)).json()).slots.includes(start));
      assert.equal((await request("time-off/save", { id: block.id, reason: "Long lunch", startsAt: start, endsAt: DateTime.fromISO(end).plus({ minutes: 15 }).toISO() })).status, 200);
      assert.equal((await request("time-off/remove", { id: block.id })).status, 200);
      assert.ok((await (await request(`availability?service=${serviceId}&date=${day}`)).json()).slots.includes(start));
    });
    await t.test("multi-week time off works as one editable block", async () => {
      const from = DateTime.now().setZone("America/Los_Angeles").plus({ days: 20 }).startOf("day");
      const until = from.plus({ days: 8 });
      const response = await request("time-off/save", { reason: "Vacation", startsAt: from.toUTC().toISO(), endsAt: until.toUTC().toISO() });
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      const block = (await response.json()).block;
      assert.equal((await (await request(`day?date=${from.plus({ days: 7 }).toISODate()}`)).json()).blocks[0].id, block.id);
      assert.equal((await request("time-off/remove", { id: block.id })).status, 200);
      assert.equal((await payload.count({ collection: "occupancy" })).totalDocs, 0);
    });
    await t.test("hours and service prices use simple safe units", async () => {
      const invalid = await request("settings", { bookingEnabled: true, weeklyHours: [], leadMinutes: 0, bookingDays: 30, cancellationHours: 24 });
      assert.equal(invalid.status, 400);
      const price = await request("services/save", { id: serviceId, price: "35.50", durationMinutes: 40, bufferMinutes: 5, active: true });
      assert.equal(price.status, 200);
      assert.equal((await price.json()).service.priceCents, 3550);
      assert.equal((await request("services/save", { id: serviceId, price: "-1", durationMinutes: 40, bufferMinutes: 5, active: true })).status, 400);
    });
  } finally {
    const client = (payload.db as unknown as SQLiteAdapter).client;
    await payload.destroy(); client.close(); global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
