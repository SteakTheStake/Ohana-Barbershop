import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DateTime } from "luxon";
import { NextRequest } from "next/server";
import type { SQLiteAdapter } from "@payloadcms/db-sqlite";

test("real SQLite booking, phone login, privacy and transactional locking", { timeout: 120_000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-test-"));
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.DATABASE_URL = `file:${path.join(temp, "test.db").replace(/\\/g, "/")}`;
  process.env.PAYLOAD_SECRET = randomBytes(48).toString("hex");
  process.env.CMS_ADMIN_EMAIL = "test-owner@ohana.local";
  process.env.CMS_ADMIN_PASSWORD = randomBytes(24).toString("hex");
  process.env.SMS_PROVIDER = "console";
  process.env.APP_URL = "http://localhost:3000";
  process.env.TRUST_PROXY = "false";
  process.env.GOOGLE_CALENDAR_ENABLED = "false";
  const { getCMS } = await import("../src/lib/cms");
  const { readAvailability } = await import("../src/lib/booking-data");
  const { GET, POST } = await import("../src/app/api/ohana/[...path]/route");
  const payload = await getCMS();
  const request = async (route: string, data?: unknown, cookie?: string, origin = "http://localhost:3000") => {
    if (route === "appointments" && data) data = { requestId: randomUUID(), ...data as object };
    const req = new NextRequest(`http://localhost:3000/api/ohana/${route}`, {
      method: data === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", origin, ...(cookie ? { cookie } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return (data === undefined ? GET : POST)(req, { params: Promise.resolve({ path: route.split("/") }) });
  };
  try {
    const service = (await payload.find({ collection: "services", limit: 1 })).docs[0];
    const day = DateTime.now().setZone("America/Los_Angeles").plus({ days: 3 }).toISODate()!;
    await payload.updateGlobal({ slug: "shop-settings", data: {
      bookingEnabled: true, leadMinutes: 0, bookingDays: 90, cancellationHours: 24,
      weeklyHours: Array.from({ length: 7 }, (_, n) => ({ weekday: String(n) as "0", closed: false, opens: "09:00", closes: "17:00" })),
    } });
    let cookie = "";
    let customerId = 0;
    let appointmentId = 0;
    let originalStart = "";

    await t.test("anonymous CMS reads and writes cannot expose customer records or services", async () => {
      await assert.rejects(payload.find({ collection: "customers", overrideAccess: false }));
      for (const collection of ["customer-sessions", "phone-challenges", "used-challenges", "rate-limits", "occupancy"] as const) {
        await assert.rejects(payload.find({ collection, overrideAccess: false }));
      }
      await assert.rejects(payload.create({ collection: "services", overrideAccess: false, data: { name: "Forged", slug: "forged", priceCents: 1, durationMinutes: 30, bufferMinutes: 0, active: true } }));
      const response = await request("appointments");
      assert.equal(response.status, 401);
    });
    await t.test("cross-origin login requests are rejected", async () => {
      assert.equal((await request("auth/send", { phone: "5415550100" }, undefined, "https://evil.example")).status, 403);
    });
    await t.test("wrong codes fail, a valid code creates a secure session, and replay fails", async () => {
      const sent = await request("auth/send", { phone: "(541) 555-0100" });
      assert.equal(sent.status, 200);
      const challenge = await sent.json();
      assert.match(challenge.developmentCode, /^\d{6}$/);
      const wrong = await request("auth/verify", { challengeId: challenge.challengeId, name: "Test Customer", code: "000000" });
      assert.equal(wrong.status, 400);
      const verified = await request("auth/verify", { challengeId: challenge.challengeId, name: "Test Customer", code: challenge.developmentCode });
      assert.equal(verified.status, 200, JSON.stringify(await verified.clone().json()));
      cookie = verified.headers.get("set-cookie")!.split(";")[0];
      assert.match(verified.headers.get("set-cookie")!, /HttpOnly/i);
      assert.match(verified.headers.get("set-cookie")!, /SameSite=strict/i);
      customerId = (await verified.json()).customer.id;
      const replay = await request("auth/verify", { challengeId: challenge.challengeId, name: "Test Customer", code: challenge.developmentCode });
      assert.equal(replay.status, 400);
      const session = await request("session", undefined, cookie);
      assert.equal((await session.json()).customer.id, customerId);
    });
    await t.test("booking uses trusted pricing and locks each occupied interval", async () => {
      const slots = await readAvailability(payload, service, day);
      originalStart = slots[0];
      const fields = { requestId: randomUUID(), serviceId: service.id, startsAt: originalStart, priceCents: 1 };
      const result = await request("appointments", fields, cookie);
      assert.equal(result.status, 201, JSON.stringify(await result.clone().json()));
      const appointment = (await result.json()).appointment;
      appointmentId = appointment.id;
      const replay = await request("appointments", fields, cookie);
      assert.equal(replay.status, 201);
      assert.equal((await replay.json()).appointment.id, appointmentId);
      assert.equal(appointment.priceCents, service.priceCents);
      const available = await readAvailability(payload, service, day);
      assert.ok(!available.includes(originalStart));
      const duplicate = await request("appointments", { serviceId: service.id, startsAt: originalStart }, cookie);
      assert.equal(duplicate.status, 409);
    });
    await t.test("simultaneous overlapping bookings result in only one committed appointment", async () => {
      const slots = await readAvailability(payload, service, day);
      const start = slots[3];
      const other = slots[4];
      const results = await Promise.all([
        request("appointments", { serviceId: service.id, startsAt: start }, cookie),
        request("appointments", { serviceId: service.id, startsAt: other }, cookie),
      ]);
      assert.equal(results.filter((r) => r.status === 201).length, 1, `statuses: ${results.map((r) => r.status)}`);
      assert.ok(results.some((r) => r.status === 409), "overlap must be a conflict, not a database error");
      const count = await payload.count({ collection: "appointments", where: { customer: { equals: customerId } } });
      assert.equal(count.totalDocs, 2, "the failed transaction must not leave a phantom booking");
    });
    await t.test("conflicting time off rolls back completely, successful time off blocks slots", async () => {
      const appointment = await payload.findByID({ collection: "appointments", id: appointmentId });
      await assert.rejects(payload.create({ collection: "time-off", data: { reason: "Conflict", startsAt: appointment.startsAt, endsAt: appointment.endsAt } }));
      assert.equal((await payload.count({ collection: "time-off" })).totalDocs, 0);
      const available = await readAvailability(payload, service, day);
      const start = available.at(-1)!;
      const timeOff = await payload.create({ collection: "time-off", data: {
        reason: "Lunch", startsAt: start, endsAt: DateTime.fromISO(start).plus({ minutes: 30 }).toISO()!,
      } });
      assert.ok(!(await readAvailability(payload, service, day)).includes(start));
      await payload.delete({ collection: "time-off", id: timeOff.id });
      assert.ok((await readAvailability(payload, service, day)).includes(start));
    });
    await t.test("customers cannot view or change another customer's appointment", async () => {
      const stranger = await payload.create({ collection: "customers", data: { name: "Other Customer", phone: "+15415550199", preferences: "PRIVATE NOTE" } });
      const slots = await readAvailability(payload, service, day);
      const otherAppointment = await payload.create({ collection: "appointments", data: {
        customer: stranger.id, service: service.id, startsAt: slots[5], endsAt: slots[5], blockedUntil: slots[5], serviceName: "", priceCents: 0, status: "confirmed", revision: 1,
      } });
      const list = await (await request("appointments", undefined, cookie)).json();
      assert.ok(!list.appointments.some((a: { id: number }) => a.id === otherAppointment.id));
      assert.ok(!JSON.stringify(list).includes("PRIVATE NOTE"));
      assert.equal((await request("appointments/cancel", { id: otherAppointment.id }, cookie)).status, 404);
    });
    await t.test("rescheduling is atomic and cancellation releases availability", async () => {
      const slots = await readAvailability(payload, service, day);
      const next = slots[0];
      await payload.update({ collection: "services", id: service.id, data: { priceCents: service.priceCents + 1000 } });
      const updated = await request("appointments/reschedule", { id: appointmentId, startsAt: next }, cookie);
      assert.equal(updated.status, 200, JSON.stringify(await updated.clone().json()));
      assert.equal((await updated.json()).appointment.priceCents, service.priceCents, "a time-only change must retain the customer's quoted price");
      await payload.update({ collection: "services", id: service.id, data: { priceCents: service.priceCents } });
      assert.ok((await readAvailability(payload, service, day)).includes(originalStart));
      const failed = await request("appointments/reschedule", { id: appointmentId, startsAt: `${day}T03:00:00Z` }, cookie);
      assert.equal(failed.status, 409);
      assert.equal((await payload.findByID({ collection: "appointments", id: appointmentId })).startsAt, next);
      const cancelled = await request("appointments/cancel", { id: appointmentId }, cookie);
      assert.equal(cancelled.status, 200);
      assert.ok((await readAvailability(payload, service, day)).includes(next));
    });
    await t.test("non-overlapping concurrent writes both commit, and owner edits keep locks consistent", async () => {
      const available = await readAvailability(payload, service, day);
      const records = await Promise.all([available[0], available[4]].map((startsAt) =>
        payload.create({ collection: "appointments", data: {
          customer: customerId, service: service.id, startsAt, endsAt: startsAt, blockedUntil: startsAt,
          serviceName: "", priceCents: 0, status: "confirmed", revision: 1,
        } }),
      ));
      assert.equal(records.length, 2);
      await assert.rejects(payload.update({ collection: "appointments", id: records[0].id, data: { startsAt: records[1].startsAt } }));
      assert.equal((await payload.findByID({ collection: "appointments", id: records[0].id })).startsAt, records[0].startsAt);
      assert.ok(!(await readAvailability(payload, service, day)).includes(records[0].startsAt));
    });
    await t.test("cancellation policy and the booking-off switch are enforced server-side", async () => {
      // Isolate policy assertions from this suite's accumulated booking throttle.
      await payload.delete({ collection: "rate-limits", where: {} });
      const visit = (await payload.find({ collection: "appointments", depth: 0, limit: 1, where: { and: [
        { customer: { equals: customerId } }, { status: { equals: "confirmed" } },
      ] } })).docs[0];
      await payload.updateGlobal({ slug: "shop-settings", data: { cancellationHours: 168 } });
      assert.equal((await request("appointments/cancel", { id: visit.id }, cookie)).status, 409);
      await payload.updateGlobal({ slug: "shop-settings", data: { cancellationHours: 24, bookingEnabled: false } });
      assert.deepEqual(await readAvailability(payload, service, day), []);
      assert.equal((await request("appointments", { serviceId: service.id, startsAt: originalStart }, cookie)).status, 409);
      const owner = { ...(await payload.find({ collection: "users", limit: 1 })).docs[0], collection: "users" };
      const importedStart = DateTime.fromISO(originalStart).plus({ hours: 6 }).toUTC().toISO()!;
      const imported = await payload.create({ collection: "appointments", overrideAccess: false, user: owner, data: {
        customer: customerId, service: service.id, startsAt: importedStart, endsAt: importedStart,
        blockedUntil: importedStart, serviceName: "", priceCents: 0, status: "confirmed", revision: 1,
      } });
      assert.equal(imported.status, "confirmed", "the owner can enter existing bookings before opening public scheduling");
      await payload.updateGlobal({ slug: "shop-settings", data: { bookingEnabled: true } });
    });
    await t.test("expired verification challenges cannot create sessions", async () => {
      const expired = await payload.create({ collection: "phone-challenges", data: { phone: "+15415550100", expiresAt: new Date(Date.now() - 1000).toISOString() } });
      assert.equal((await request("auth/verify", { challengeId: expired.id, code: "123456", name: "Test Customer" })).status, 400);
    });
    await t.test("phone send throttling is persistent and logout revokes the token", async () => {
      for (let i = 0; i < 3; i++) assert.equal((await request("auth/send", { phone: "+15415550150" })).status, 200);
      assert.equal((await request("auth/send", { phone: "+15415550150" })).status, 429);
      assert.equal((await request("auth/logout", {}, cookie)).status, 200);
      assert.equal((await (await request("session", undefined, cookie)).json()).customer, null);
    });
  } finally {
    const client = (payload.db as unknown as SQLiteAdapter).client;
    await payload.destroy();
    client.close();
    // libSQL 0.14 releases completed transaction handles through GC on Windows.
    global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
