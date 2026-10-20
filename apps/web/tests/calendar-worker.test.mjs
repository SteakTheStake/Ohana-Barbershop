import assert from "node:assert/strict";
import { test } from "node:test";
import { runCalendarSync } from "../scripts/calendar-sync.mjs";

const env = { GOOGLE_CALENDAR_ENABLED: "true", GOOGLE_CALENDAR_SYNC_SECRET: "test-only-secret-at-least-32-characters" };
test("calendar worker does nothing when disabled and never logs secrets or remote bodies", async () => {
  const messages = [];
  const log = (value) => messages.push(value);
  let calls = 0;
  const transport = async () => { calls++; return Response.json({ secret: "PRIVATE" }, { status: 403 }); };
  assert.equal(await runCalendarSync({ env: {}, transport, log }), 0);
  assert.equal(calls, 0);
  assert.equal(await runCalendarSync({ env, transport, log }), 1);
  assert.ok(!JSON.stringify(messages).includes(env.GOOGLE_CALENDAR_SYNC_SECRET));
  assert.ok(!JSON.stringify(messages).includes("PRIVATE"));
});
test("calendar worker authenticates only to loopback and supports private health checks", async () => {
  for (const check of [false, true]) {
    const transport = async (url, init) => {
      assert.equal(url, "http://127.0.0.1:3000/api/calendar-sync");
      assert.equal(init.method, check ? "GET" : "POST");
      assert.equal(init.headers.Authorization, `Bearer ${env.GOOGLE_CALENDAR_SYNC_SECRET}`);
      return Response.json({ healthy: true, state: "healthy", conflictCount: 0 });
    };
    assert.equal(await runCalendarSync({ env, transport, check, log() {} }), 0);
  }
});
test("worker reports failures for conflicts, unhealthy responses, invalid JSON and network errors", async () => {
  for (const transport of [
    async () => Response.json({ healthy: false, conflictCount: 1 }),
    async () => new Response("", { status: 503 }),
    async () => new Response("not json"),
    async () => { throw new Error("PRIVATE NETWORK DETAILS"); },
  ]) assert.equal(await runCalendarSync({ env, transport, log() {} }), 1);
});
