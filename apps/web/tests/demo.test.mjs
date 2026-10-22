import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoSession, DEMO_SECONDS, demoDatabaseURL, demoPasswordMatches, demoReturnPath, validDemoSession } from "../src/lib/demo.ts";

test("demo password, signed sessions, opt-in behavior and database isolation", () => {
  const saved = { ...process.env };
  try {
    process.env.DEMO_MODE = "true";
    process.env.PAYLOAD_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
    delete process.env.DEMO_PASSWORD;
    assert.equal(demoPasswordMatches("ohana26"), true);
    assert.equal(demoPasswordMatches("Ohana26"), false);
    assert.equal(demoPasswordMatches(""), false);
    const now = 1_800_000_000_000;
    const token = createDemoSession(now);
    assert.equal(validDemoSession(token, now), true);
    assert.equal(validDemoSession(token, now + DEMO_SECONDS * 1000), false);
    assert.equal(validDemoSession(token, now - 1000), false);
    assert.equal(validDemoSession(`${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`, now), false);
    assert.equal(validDemoSession("forged", now), false);
    assert.equal(validDemoSession(undefined, now), false);
    process.env.PAYLOAD_SECRET = "another-long-test-secret-for-a-separate-environment";
    assert.equal(validDemoSession(token, now), false);
    process.env.DEMO_MODE = "false";
    assert.equal(validDemoSession(createDemoSession(now), now), false);
    assert.equal(demoPasswordMatches("ohana26"), false);
    delete process.env.DEMO_MODE;
    assert.equal(demoPasswordMatches("ohana26"), false);
    process.env.DEMO_MODE = "true";
    process.env.DEMO_PASSWORD = "custom-preview-password";
    assert.equal(demoPasswordMatches("ohana26"), false);
    assert.equal(demoPasswordMatches("custom-preview-password"), true);
    process.env.DATABASE_URL = "file:/production/ohana.db";
    delete process.env.DEMO_DATABASE_URL;
    assert.equal(demoDatabaseURL(), "file:./ohana-demo.db");
    process.env.DEMO_DATABASE_URL = "file:/demo/ohana-demo.db";
    assert.equal(demoDatabaseURL(), process.env.DEMO_DATABASE_URL);
    for (const url of ["file:/production/ohana.db", "https://database.example/ohana-demo.db", "file:/demo/ohana-demo.db?mode=rw"]) {
      process.env.DEMO_DATABASE_URL = url;
      assert.throws(demoDatabaseURL, /local file named ohana-demo.db/);
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("demo redirects stay on the website and avoid login loops", () => {
  assert.equal(demoReturnPath("/owner"), "/owner");
  assert.equal(demoReturnPath("/services?preview=1"), "/services?preview=1");
  for (const url of ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/demo", "/api/demo", "/owner\r\nLocation: evil", null, undefined]) {
    assert.equal(demoReturnPath(url), "/");
  }
});
