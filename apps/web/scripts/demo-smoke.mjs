import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const temp = await mkdtemp(path.join(os.tmpdir(), "ohana-demo-smoke-"));
const env = {
  ...process.env,
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  DEMO_MODE: "true", DEMO_PASSWORD: randomBytes(24).toString("hex"),
  PAYLOAD_SECRET: randomBytes(48).toString("hex"),
  APP_URL: "https://summitmc.xyz", OWNER_APP_URL: "https://owner.summitmc.xyz",
  DEMO_DATABASE_URL: `file:${path.join(temp, "ohana-demo.db")}`,
  SMS_PROVIDER: "disabled", GOOGLE_CALENDAR_ENABLED: "false", TRUST_PROXY: "false",
};
let server;
let output = "";
try {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port),
  ], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => { output = (output + chunk).slice(-12_000); });
  }
  const request = (host, route, options = {}) => fetch(`http://127.0.0.1:${port}${route}`, {
    ...options, redirect: "manual", signal: AbortSignal.timeout(15_000),
    headers: { ...options.headers, host },
  });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.equal(server.exitCode, null, "Demo server exited before becoming healthy");
    try {
      const response = await request("summitmc.xyz", "/api/health");
      assert.equal(response.status, 200, "Built demo health endpoint failed");
      await response.arrayBuffer();
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  assert.ok(ready, "Built demo did not become healthy");
  for (const host of ["summitmc.xyz", "owner.summitmc.xyz"]) {
    for (const route of ["/", "/about", "/shop", "/book", "/owner", "/large-logo.png"]) {
      const response = await request(host, route);
      assert.equal(response.status, 307, `${host}${route} must require the demo password`);
      assert.equal(new URL(response.headers.get("location")).pathname, "/demo");
      assert.match(response.headers.get("cache-control"), /no-store/);
      await response.arrayBuffer();
    }
    const api = await request(host, "/api/owner/session");
    assert.equal(api.status, 401);
    await api.arrayBuffer();
    const preview = await request(host, "/demo");
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), /Demo password/);
    const login = async (password) => request(host, "/api/demo", {
      method: "POST",
      headers: { origin: `https://${host}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password, next: "/owner" }),
    });
    const wrong = await login("incorrect-password");
    assert.equal(wrong.status, 303);
    assert.match(wrong.headers.get("location"), /error=password/);
    assert.equal(wrong.headers.get("set-cookie"), null);
    await wrong.arrayBuffer();
    const accepted = await login(env.DEMO_PASSWORD);
    assert.equal(accepted.status, 303);
    assert.equal(accepted.headers.get("location"), `https://${host}/owner`);
    const sessionCookie = accepted.headers.get("set-cookie");
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /Secure/i);
    assert.doesNotMatch(sessionCookie, /;\s*Domain=/i);
    const cookie = sessionCookie.split(";")[0];
    await accepted.arrayBuffer();
    for (const route of ["/", "/shop", "/owner", "/api/owner/session"]) {
      const response = await request(host, route, { headers: { cookie } });
      assert.equal(response.status, 200, `Authenticated demo failed: ${host}${route}`);
      await response.arrayBuffer();
    }
    const locked = await request(host, "/api/demo/logout", {
      method: "POST", headers: { cookie, origin: `https://${host}` },
    });
    assert.equal(locked.status, 303);
    assert.match(locked.headers.get("set-cookie"), /Max-Age=0/i);
    await locked.arrayBuffer();
    assert.equal((await request(host, "/")).status, 307);
  }
  console.log("Built demo smoke test passed: both hosts gate all pages, APIs, login, owner access, and logout.");
} catch (error) {
  console.error(output.replaceAll(env.PAYLOAD_SECRET, "[redacted]").replaceAll(env.DEMO_PASSWORD, "[redacted]"));
  throw error;
} finally {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    const timeout = setTimeout(() => server.kill("SIGKILL"), 5_000);
    try { await exited; } finally { clearTimeout(timeout); }
  }
  await rm(temp, { recursive: true, force: true });
}
