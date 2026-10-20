import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { externalBusy, GoogleCalendar, GoogleEventGone, googleCalendarConfig, managedEventId, type GoogleEvent } from "./google-calendar";

const namespace = "ohana-test-calendar-namespace";
const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const config = { calendarId: "test@group.calendar.google.com", email: "test@example.iam.gserviceaccount.com", privateKey, namespace };
const event: GoogleEvent = {
  id: "rosie-booking", summary: "Haircut",
  start: { dateTime: "2026-11-01T09:00:00-08:00" }, end: { dateTime: "2026-11-01T09:30:00-08:00" },
};

test("Google bridge is opt-in and invalid enabled configuration fails closed", () => {
  const previous = process.env.GOOGLE_CALENDAR_ENABLED;
  try {
    process.env.GOOGLE_CALENDAR_ENABLED = "false";
    assert.equal(googleCalendarConfig(), null);
    process.env.GOOGLE_CALENDAR_ENABLED = "typo";
    assert.throws(googleCalendarConfig);
    process.env.GOOGLE_CALENDAR_ENABLED = "true";
    assert.throws(googleCalendarConfig);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CALENDAR_ENABLED;
    else process.env.GOOGLE_CALENDAR_ENABLED = previous;
  }
});

test("external busy includes Rosie and other environments, excluding free/cancelled/own events", () => {
  const events = [
    event, { ...event, id: "cancelled", status: "cancelled" }, { ...event, id: "free", transparency: "transparent" },
    { ...event, id: "own", extendedProperties: { private: { ohanaNamespace: namespace } } },
    { ...event, id: "other", extendedProperties: { private: { ohanaNamespace: "other-shop" } } },
  ];
  const busy = externalBusy(events, namespace);
  assert.deepEqual(busy.map((b) => b.id), ["rosie-booking", "other"]);
  assert.equal(busy[0].startsAt, "2026-11-01T17:00:00.000Z");
  assert.throws(() => externalBusy([{ id: "broken" }], namespace));
});

test("all-day Google events block the entire Pacific day across DST", () => {
  const [busy] = externalBusy([{ id: "holiday", start: { date: "2026-11-01" }, end: { date: "2026-11-02" } }], namespace);
  assert.equal(busy.startsAt, "2026-11-01T07:00:00.000Z");
  assert.equal(busy.blockedUntil, "2026-11-02T08:00:00.000Z");
});

test("Google event IDs are deterministic, valid and isolated by environment and collection", () => {
  const id = managedEventId(namespace, "appointment", 1);
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.equal(managedEventId(namespace, "appointment", 1), id);
  assert.notEqual(managedEventId(namespace, "time-off", 1), id);
  assert.notEqual(managedEventId("other", "appointment", 1), id);
});

test("service-account auth, recurring expansion, pagination and no-store requests", async () => {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const transport = (async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(init?.cache, "no-store");
    if (url.hostname === "oauth2.googleapis.com") {
      const body = init?.body as URLSearchParams;
      const assertion = body.get("assertion")!;
      const claims = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString());
      assert.equal(claims.iss, config.email);
      assert.equal(claims.scope, "https://www.googleapis.com/auth/calendar.events");
      return Response.json({ access_token: "fake-test-token" });
    }
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer fake-test-token");
    assert.equal(url.searchParams.get("singleEvents"), "true");
    assert.equal(url.searchParams.get("timeMin"), "2026-11-01T07:00:00.000Z");
    assert.equal(url.searchParams.get("timeMax"), "2026-11-02T08:00:00.000Z");
    return url.searchParams.has("pageToken")
      ? Response.json({ items: [{ ...event, id: "second" }] })
      : Response.json({ items: [event], nextPageToken: "page2" });
  }) as typeof fetch;
  const busy = await new GoogleCalendar(config, transport).busy("2026-11-01");
  assert.equal(busy.length, 2);
  assert.equal(calls.length, 3);
});

test("Google failures never produce an empty/free schedule", async () => {
  for (const status of [401, 403, 429, 500]) {
    const calendar = new GoogleCalendar(config, (async (input) => String(input).includes("oauth2")
      ? Response.json({ access_token: "fake" })
      : new Response("", { status })) as typeof fetch);
    await assert.rejects(calendar.busy("2026-11-01"));
  }
});

test("upsert creates only on 404 and does not turn permission failures into inserts", async () => {
  const methods: string[] = [];
  const transport = (async (input, init) => {
    if (String(input).includes("oauth2")) return Response.json({ access_token: "fake" });
    methods.push(init?.method ?? "GET");
    return new Response("{}", { status: !init?.method ? 404 : 200 });
  }) as typeof fetch;
  await new GoogleCalendar(config, transport).upsert("abc123", { summary: "Test" });
  assert.deepEqual(methods, ["GET", "POST"]);
  const denied = new GoogleCalendar(config, (async (input) => String(input).includes("oauth2")
    ? Response.json({ access_token: "fake" }) : new Response("", { status: 403 })) as typeof fetch);
  await assert.rejects(denied.upsert("abc123", {}));
});

test("upsert never overwrites an unowned event and uses ETags for managed updates", async () => {
  const methods: string[] = [];
  const transport = (owned: boolean) => (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("oauth2")) return Response.json({ access_token: "fake" });
    methods.push(init?.method ?? "GET");
    if (init?.method === "PATCH") {
      assert.equal((init.headers as Record<string, string>)["If-Match"], '"version1"');
      return Response.json({});
    }
    return Response.json({ id: "abc123", etag: '"version1"', extendedProperties: { private: { ohanaNamespace: owned ? namespace : "another-shop" } } });
  }) as typeof fetch;
  await assert.rejects(new GoogleCalendar(config, transport(false)).upsert("abc123", {}));
  assert.deepEqual(methods, ["GET"]);
  methods.length = 0;
  await new GoogleCalendar(config, transport(true)).upsert("abc123", {});
  assert.deepEqual(methods, ["GET", "PATCH"]);
});

test("cancelled Google event IDs are treated as tombstones, not reusable bookings", async () => {
  const calendar = new GoogleCalendar(config, (async (input) => String(input).includes("oauth2")
    ? Response.json({ access_token: "fake" }) : Response.json({ id: "abc123", status: "cancelled" })) as typeof fetch);
  await assert.rejects(calendar.upsert("abc123", {}), GoogleEventGone);
});

test("a lost insert response recovers through the same event ID without duplicate bookings", async () => {
  let saved: Record<string, unknown> | undefined;
  let inserts = 0;
  const transport = (async (input, init) => {
    if (String(input).includes("oauth2")) return Response.json({ access_token: "fake" });
    if (init?.method === "POST") {
      inserts++;
      if (saved) return new Response("", { status: 409 });
      saved = JSON.parse(String(init.body));
      return new Response("", { status: 503 });
    }
    if (init?.method === "PATCH") return Response.json(saved);
    return saved ? Response.json(saved) : new Response("", { status: 404 });
  }) as typeof fetch;
  await new GoogleCalendar(config, transport).upsert("abc123", {
    extendedProperties: { private: { ohanaNamespace: namespace } }, summary: "Haircut",
  });
  assert.equal(saved?.id, "abc123");
  assert.equal(inserts, 2, "The second attempt detects the already-created event");
});

test("Google retries transient failures, but respects long Retry-After without spinning", async () => {
  let calls = 0;
  const calendar = new GoogleCalendar(config, (async (input) => {
    if (String(input).includes("oauth2")) return Response.json({ access_token: "fake" });
    calls++;
    return calls === 1 ? new Response("", { status: 503 }) : Response.json({ items: [] });
  }) as typeof fetch);
  assert.deepEqual(await calendar.busy("2026-11-01"), []);
  assert.equal(calls, 2);
  const throttled = new GoogleCalendar(config, (async (input) => String(input).includes("oauth2")
    ? Response.json({ access_token: "fake" }) : new Response("", { status: 429, headers: { "Retry-After": "600" } })) as typeof fetch);
  await assert.rejects(throttled.busy("2026-11-01"), (error: unknown) => (error as { retryAfter: number }).retryAfter === 600);
});

test("direct Google booking requires explicit risk acknowledgement and valid credentials", () => {
  const variables = {
    GOOGLE_CALENDAR_ENABLED: "true", GOOGLE_CALENDAR_ID: config.calendarId, GOOGLE_SERVICE_ACCOUNT_EMAIL: config.email,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: config.privateKey, GOOGLE_CALENDAR_NAMESPACE: namespace,
    ROSIE_BOOKING_MODE: "calendar", ROSIE_ACCEPT_NONATOMIC_BOOKINGS: "false",
  };
  const previous = Object.fromEntries(Object.keys(variables).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, variables);
    assert.throws(googleCalendarConfig, /explicit acceptance/);
    process.env.ROSIE_ACCEPT_NONATOMIC_BOOKINGS = "true";
    assert.equal(googleCalendarConfig()?.bookingMode, "calendar");
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "invalid";
    assert.throws(googleCalendarConfig);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
