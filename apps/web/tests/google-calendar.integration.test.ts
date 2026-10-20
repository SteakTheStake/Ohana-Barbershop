import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DateTime } from "luxon";
import { NextRequest } from "next/server";
import { createLocalReq } from "payload";
import type { SQLiteAdapter } from "@payloadcms/db-sqlite";
import type { GoogleEvent } from "../src/lib/google-calendar";

test("Google Calendar bridge with real SQLite and mocked Google only", { timeout: 120_000 }, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-google-test-"));
  Object.assign(process.env, {
    NODE_ENV: "test", DATABASE_URL: `file:${path.join(temp, "test.db").replace(/\\/g, "/")}`,
    PAYLOAD_SECRET: randomBytes(48).toString("hex"), CMS_ADMIN_EMAIL: "owner@ohana.test",
    CMS_ADMIN_PASSWORD: randomBytes(24).toString("hex"), SMS_PROVIDER: "console",
    APP_URL: "http://localhost:3000", GOOGLE_CALENDAR_ENABLED: "false", GOOGLE_CALENDAR_AUTO_SYNC: "false",
  });
  const { getCMS } = await import("../src/lib/cms");
  const { readAvailability } = await import("../src/lib/booking-data");
  const { ownerDay } = await import("../src/lib/owner-server");
  const { syncGoogleCalendar, GOOGLE_SYNC_KEY } = await import("../src/lib/google-calendar-sync");
  const { managedEventId } = await import("../src/lib/google-calendar");
  const { googleCalendarStatus, GOOGLE_FAILURE_KEY } = await import("../src/lib/google-calendar-state");
  const { POST, GET } = await import("../src/app/api/calendar-sync/route");
  const payload = await getCMS();
  const events = new Map<string, GoogleEvent>();
  let googleDown = false;
  let failWrites = false;
  let duringExport: (() => Promise<void>) | null = null;
  let writes = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "test-token" });
    assert.equal(url.hostname, "www.googleapis.com", "Tests must never send a real network request");
    if (googleDown) return new Response("", { status: 503 });
    const prefix = "/calendar/v3/calendars/test-calendar/events";
    assert.ok(url.pathname.startsWith(prefix));
    const id = decodeURIComponent(url.pathname.slice(prefix.length + 1));
    const method = init?.method ?? "GET";
    if (failWrites && method !== "GET") return new Response("", { status: 503 });
    if (method === "GET") {
      if (id) return events.has(id) ? Response.json(events.get(id)) : new Response("", { status: 404 });
      let items = [...events.values()].filter((e) => e.status !== "cancelled");
      const property = url.searchParams.get("privateExtendedProperty");
      if (property && duringExport) {
        const change = duringExport;
        duringExport = null;
        await change();
      }
      if (property) items = items.filter((e) => e.extendedProperties?.private?.ohanaNamespace === property.split("=")[1]);
      return Response.json({ items });
    }
    writes++;
    const body = JSON.parse(String(init?.body));
    if (method === "PATCH") {
      if (!events.has(id)) return new Response("", { status: 404 });
      events.set(id, { ...events.get(id), ...body });
    } else if (method === "POST") {
      assert.ok(!events.has(body.id), "Must not insert a duplicate");
      events.set(body.id, body);
    } else assert.fail(`Unexpected HTTP method ${method}`);
    return Response.json({ ok: true });
  });
  const day = DateTime.now().setZone("America/Los_Angeles").plus({ days: 3 }).toISODate()!;
  const instant = (time: string) => DateTime.fromISO(`${day}T${time}`, { zone: "America/Los_Angeles" }).toUTC().toISO()!;
  const namespace = "integration-test-namespace";
  try {
    const service = (await payload.find({ collection: "services", limit: 1 })).docs[0];
    const customer = await payload.create({ collection: "customers", data: { name: "Private Customer", phone: "+15415550999" } });
    const owner = (await payload.find({ collection: "users", limit: 1 })).docs[0];
    const req = await createLocalReq({ user: { ...owner, collection: "users" } }, payload);
    await payload.updateGlobal({ slug: "shop-settings", data: {
      bookingEnabled: true, leadMinutes: 0, bookingDays: 90,
      weeklyHours: Array.from({ length: 7 }, (_, n) => ({ weekday: String(n) as "0", closed: false, opens: "09:00", closes: "17:00" })),
    } });
    const fields = (start: string) => ({
      customer: customer.id, service: service.id, startsAt: start, endsAt: start, blockedUntil: start,
      revision: 1, serviceName: "", priceCents: 0, status: "confirmed" as const, notes: "PRIVATE NOTES",
    });

    await t.test("sync endpoint rejects missing/incorrect credentials before touching the calendar", async () => {
      process.env.GOOGLE_CALENDAR_SYNC_SECRET = randomBytes(32).toString("hex");
      for (const token of ["", "Bearer wrong"]) {
        assert.equal((await POST(new NextRequest("http://localhost:3000/api/calendar-sync", {
          method: "POST", headers: { authorization: token },
        }))).status, 401);
      }
      assert.equal(fetchMock.mock.calls.length, 0);
    });
    Object.assign(process.env, {
      GOOGLE_CALENDAR_ENABLED: "true", GOOGLE_CALENDAR_ID: "test-calendar",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      GOOGLE_CALENDAR_NAMESPACE: namespace,
    });
    events.set("rosie", {
      id: "rosie", summary: "Rosie haircut", start: { dateTime: instant("09:00") }, end: { dateTime: instant("09:30") },
    });
    await t.test("a new database cannot silently adopt and erase an existing managed calendar", async () => {
      events.set("previous-installation", {
        id: "previous-installation", start: { dateTime: instant("11:00") }, end: { dateTime: instant("11:30") },
        extendedProperties: { private: { ohanaNamespace: namespace } },
      });
      const before = writes;
      await assert.rejects(syncGoogleCalendar(payload), /unrecognized database/);
      assert.equal(writes, before);
      assert.equal(events.get("previous-installation")?.status, undefined);
      events.delete("previous-installation");
    });
    await t.test("enabled bridge requires an initial successful outbound sync", async () => {
      await assert.rejects(readAvailability(payload, service, day), /sync is overdue/);
      await syncGoogleCalendar(payload, true);
    });
    await t.test("Rosie busy times block availability and are rechecked at appointment creation", async () => {
      const slots = await readAvailability(payload, service, day);
      assert.ok(!slots.includes(instant("09:00")));
      assert.ok(slots.includes(instant("09:30")));
      await assert.rejects(payload.create({ collection: "appointments", data: fields(instant("09:00")) }));
      assert.equal((await payload.count({ collection: "appointments" })).totalDocs, 0);
      await assert.rejects(payload.create({ collection: "time-off", data: {
        reason: "Lunch", startsAt: instant("09:00"), endsAt: instant("09:30"),
      } }), /overlaps a Google Calendar booking/);
      const result = await ownerDay(payload, req, day);
      assert.equal(result.externalEvents[0].title, "Rosie haircut");
      assert.equal(result.calendarWarning, null);
    });
    const visit = await payload.create({ collection: "appointments", data: fields(instant("10:00")) });
    const block = await payload.create({ collection: "time-off", data: { reason: "PRIVATE REASON", startsAt: instant("12:00"), endsAt: instant("12:30") } });
    const visitId = managedEventId(namespace, "appointment", visit.id);
    const blockId = managedEventId(namespace, "time-off", block.id);
    await t.test("authorized sync publishes appointments/time off without customer PII and repeats safely", async () => {
      const response = await POST(new NextRequest("http://localhost:3000/api/calendar-sync", {
        method: "POST", headers: { authorization: `Bearer ${process.env.GOOGLE_CALENDAR_SYNC_SECRET}` },
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).published, 2);
      const serialized = JSON.stringify([events.get(visitId), events.get(blockId)]);
      for (const privateValue of ["Private Customer", "+15415550999", "PRIVATE NOTES", "PRIVATE REASON"]) {
        assert.ok(!serialized.includes(privateValue));
      }
      assert.equal(events.get(visitId)?.end?.dateTime, visit.blockedUntil);
      const before = writes;
      await syncGoogleCalendar(payload);
      assert.equal(writes, before, "Unchanged events require no writes");
      assert.equal(events.size, 3, "Rosie event must remain untouched");
    });
    await t.test("rescheduling ignores own exported event, then updates it without creating duplicates", async () => {
      await payload.update({ collection: "appointments", id: visit.id, data: { startsAt: instant("10:15") } });
      await assert.rejects(readAvailability(payload, service, day), /schedule is syncing/);
      assert.equal((await googleCalendarStatus(payload)).state, "pending");
      await syncGoogleCalendar(payload);
      assert.equal(events.get(visitId)?.start?.dateTime, instant("10:15"));
      assert.equal(events.size, 3);
    });
    await t.test("cancellation and deleted time off remove only managed future events", async () => {
      await payload.update({ collection: "appointments", id: visit.id, data: { status: "cancelled" } });
      await payload.delete({ collection: "time-off", id: block.id });
      await syncGoogleCalendar(payload);
      assert.equal(events.get(visitId)?.status, "cancelled");
      assert.equal(events.get(blockId)?.status, "cancelled");
      assert.equal(events.get("rosie")?.status, undefined);
      assert.ok((await readAvailability(payload, service, day)).includes(instant("10:15")));
      await payload.update({ collection: "appointments", id: visit.id, data: { status: "confirmed" } });
      await syncGoogleCalendar(payload);
      const restored = [...events.values()].filter((event) => event.status === "confirmed" && event.summary === `Ohana - ${service.name}`);
      assert.equal(restored.length, 1, "Reactivation replaces Google's cancelled-ID tombstone exactly once");
      assert.notEqual(restored[0].id, visitId);
      await syncGoogleCalendar(payload);
      assert.equal([...events.values()].filter((event) => event.status === "confirmed").length, 1);
    });
    await t.test("conflicts are persisted and block bookings until explicitly resolved", async () => {
      events.set("late-rosie", { id: "late-rosie", start: { dateTime: instant("10:15") }, end: { dateTime: instant("10:45") } });
      const result = await syncGoogleCalendar(payload);
      assert.equal(result.conflicts.length, 1);
      assert.equal((await googleCalendarStatus(payload)).state, "conflict");
      await assert.rejects(readAvailability(payload, service, day), /resolves a calendar conflict/);
      assert.match((await ownerDay(payload, req, day)).calendarWarning!, /overlaps/);
      const response = await GET(new NextRequest("http://localhost:3000/api/calendar-sync", {
        headers: { authorization: `Bearer ${process.env.GOOGLE_CALENDAR_SYNC_SECRET}` },
      }));
      assert.equal(response.status, 503);
      assert.equal((await response.json()).conflictCount, 1);
      events.delete("late-rosie");
      await syncGoogleCalendar(payload);
      assert.equal((await googleCalendarStatus(payload)).healthy, true);
    });
    await t.test("Google outage fails booking closed, preserves local owner schedule and last successful sync", async () => {
      const last = await payload.kv.get(GOOGLE_SYNC_KEY);
      googleDown = true;
      await assert.rejects(readAvailability(payload, service, day));
      await assert.rejects(payload.create({ collection: "appointments", data: fields(instant("14:00")) }));
      assert.equal((await payload.count({ collection: "appointments" })).totalDocs, 1);
      const result = await ownerDay(payload, req, day);
      assert.equal(result.appointments.length, 1);
      assert.ok(result.calendarWarning);
      await assert.rejects(syncGoogleCalendar(payload));
      assert.deepEqual(await payload.kv.get(GOOGLE_SYNC_KEY), last);
      googleDown = false;
      const calls = fetchMock.mock.calls.length;
      await assert.rejects(syncGoogleCalendar(payload), /backing off/);
      assert.equal(fetchMock.mock.calls.length, calls, "Backoff must not send more network requests");
      await syncGoogleCalendar(payload, true);
      assert.equal(await payload.kv.get(GOOGLE_FAILURE_KEY), null);
    });
    await t.test("stopped scheduler or a changed calendar target fails booking closed", async () => {
      const last = await payload.kv.get<Record<string, unknown>>(GOOGLE_SYNC_KEY);
      await payload.kv.set(GOOGLE_SYNC_KEY, { ...last, syncedAt: new Date(Date.now() - 180_000).toISOString() });
      await assert.rejects(readAvailability(payload, service, day), /sync is overdue/);
      await syncGoogleCalendar(payload);
      process.env.GOOGLE_CALENDAR_ID = "another-calendar";
      await assert.rejects(readAvailability(payload, service, day), /sync is overdue/);
      process.env.GOOGLE_CALENDAR_ID = "test-calendar";
    });
    await t.test("a changed database during export never receives a falsely healthy fingerprint", async () => {
      duringExport = async () => {
        await payload.update({ collection: "appointments", id: visit.id, data: { notes: "Changed during network request" } });
      };
      await syncGoogleCalendar(payload);
      assert.equal((await googleCalendarStatus(payload)).state, "pending");
      await assert.rejects(readAvailability(payload, service, day), /schedule is syncing/);
      await syncGoogleCalendar(payload);
    });
    await t.test("committed saves trigger automatic export, but rolled-back saves never reach Google", async () => {
      process.env.GOOGLE_CALENDAR_AUTO_SYNC = "true";
      const automatic = await payload.create({ collection: "appointments", data: fields(instant("14:00")) });
      const eventId = managedEventId(namespace, "appointment", automatic.id);
      for (let n = 0; n < 200 && !(await googleCalendarStatus(payload)).healthy; n++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(events.get(eventId)?.status, "confirmed");
      assert.equal((await googleCalendarStatus(payload)).healthy, true);
      const transaction = await payload.db.beginTransaction();
      assert.notEqual(transaction, null);
      const rollbackReq = await createLocalReq({}, payload);
      rollbackReq.transactionID = transaction!;
      const rolledBack = await payload.create({ collection: "appointments", req: rollbackReq, data: fields(instant("15:00")) });
      const before = writes;
      await payload.db.rollbackTransaction(transaction!);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(writes, before);
      assert.equal(events.has(managedEventId(namespace, "appointment", rolledBack.id)), false);
    });
    await t.test("a failed post-commit export does not undo the saved visit; reconciliation recovers it", async () => {
      failWrites = true;
      const saved = await payload.create({ collection: "appointments", data: fields(instant("15:00")) });
      for (let n = 0; n < 200 && !(await payload.kv.get(GOOGLE_FAILURE_KEY)); n++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.ok(await payload.kv.get(GOOGLE_FAILURE_KEY));
      assert.equal((await payload.findByID({ collection: "appointments", id: saved.id })).status, "confirmed");
      assert.equal((await googleCalendarStatus(payload)).healthy, false);
      failWrites = false;
      await syncGoogleCalendar(payload, true);
      assert.equal((await googleCalendarStatus(payload)).healthy, true);
      assert.equal(events.get(managedEventId(namespace, "appointment", saved.id))?.status, "confirmed");
      process.env.GOOGLE_CALENDAR_AUTO_SYNC = "false";
    });
  } finally {
    fetchMock.mock.restore();
    process.env.GOOGLE_CALENDAR_ENABLED = "false";
    const client = (payload.db as unknown as SQLiteAdapter).client;
    await payload.destroy();
    client.close();
    global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
