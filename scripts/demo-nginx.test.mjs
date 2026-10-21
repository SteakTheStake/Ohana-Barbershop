import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("Nginx demo Compose isolates data, disables providers, and uses both origins", () => {
  const result = execFileSync("docker", [
    "compose", "--env-file", "/dev/null",
    "-f", "compose.demo.yaml", "-f", "compose.demo.nginx.yaml",
    "config", "--format", "json",
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      DEMO_HOST: "summitmc.xyz",
      DEMO_OWNER_HOST: "owner.summitmc.xyz",
      DEMO_PAYLOAD_SECRET: "test-only-secret-with-at-least-32-characters",
    },
  });
  const config = JSON.parse(result);
  const app = config.services.app;
  assert.equal(config.name, "ohana-demo");
  assert.equal(app.environment.APP_URL, "https://summitmc.xyz");
  assert.equal(app.environment.OWNER_APP_URL, "https://owner.summitmc.xyz");
  assert.equal(app.environment.DEMO_MODE, "true");
  assert.equal(app.environment.SMS_PROVIDER, "disabled");
  assert.equal(app.environment.GOOGLE_CALENDAR_ENABLED, "false");
  assert.equal(app.environment.DEMO_DATABASE_URL, "file:/data/ohana-demo.db");
  assert.equal(app.environment.DATABASE_URL, undefined);
  assert.deepEqual(app.volumes.map(({ type, source, target }) => ({ type, source, target })), [
    { type: "volume", source: "demo-data", target: "/data" },
  ]);
  assert.equal(app.ports.length, 1);
  assert.equal(app.ports[0].host_ip, "127.0.0.1");
  assert.equal(String(app.ports[0].published), "3102");
  assert.equal(app.ports[0].target, 3000);
  // Compose omits inactive profiles in some releases.
  if (config.services.caddy) {
    assert.deepEqual(config.services.caddy.profiles, ["standalone-proxy"]);
  }
});

test("Nginx syntax and host routing validate without touching the live proxy", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "ohana-demo-nginx-"));
  try {
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=localhost", "-keyout", `${temp}/key.pem`, "-out", `${temp}/cert.pem`,
    ], { stdio: "pipe" });
    const site = read("deploy/nginx-demo.conf")
      .replaceAll("listen 80;", "listen 127.0.0.1:18080;")
      .replaceAll("listen [::]:80;", "listen [::1]:18080;")
      .replaceAll("listen 443 ssl;", "listen 127.0.0.1:18443 ssl;")
      .replaceAll("listen [::]:443 ssl;", "listen [::1]:18443 ssl;")
      .replaceAll("/etc/letsencrypt/live/ohana-summitmc/fullchain.pem", `${temp}/cert.pem`)
      .replaceAll("/etc/letsencrypt/live/ohana-summitmc/privkey.pem", `${temp}/key.pem`)
      .replaceAll("include /etc/nginx/snippets/ohana-demo-proxy.conf;", read("deploy/nginx-demo-proxy.conf"));
    assert.match(site, /server_name summitmc\.xyz;/);
    assert.match(site, /server_name owner\.summitmc\.xyz;/);
    assert.match(site, /return 302 https:\/\/owner\.summitmc\.xyz\$request_uri;/);
    assert.match(site, /return 302 \/owner;/);
    assert.doesNotMatch(site, /return 404|127\.0\.0\.1:3101/);
    assert.equal((site.match(/proxy_pass http:\/\/127\.0\.0\.1:3102;/g) ?? []).length, 2);
    writeFileSync(`${temp}/nginx.conf`,
      `pid ${temp}/nginx.pid;\nerror_log stderr;\nevents {}\nhttp {\naccess_log off;\n${site}\n}\n`);
    execFileSync("/usr/sbin/nginx", [
      "-t", "-e", "stderr", "-p", temp, "-c", `${temp}/nginx.conf`,
    ], { stdio: "pipe" });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("launch is explicit, health-gated, and rolls back routing without stopping production", () => {
  const script = read("scripts/launch-demo-nginx.sh");
  execFileSync("bash", ["-n", path.join(root, "scripts/launch-demo-nginx.sh")]);
  assert.ok(script.indexOf('[[ "$answer" == yes ]]') < script.indexOf("compose build app"));
  assert.ok(script.indexOf("compose up -d --no-build --wait") < script.indexOf("SWITCHED=true"));
  assert.ok(script.indexOf('cp -p -- "$SITE" "$BACKUP/site.conf"') < script.indexOf("SWITCHED=true"));
  assert.match(script, /cp -p -- "\$BACKUP\/site\.conf" "\$SITE" && nginx -t && systemctl reload nginx/);
  assert.match(script, /for route in origin public/);
  assert.match(script, /expected 303/);
  assert.doesNotMatch(script, /compose down|docker (stop|rm)|production\.env|--volumes/);
  assert.doesNotMatch(script, /== unhealthy|Healthy demos require/);
  assert.match(script, /== ohana-demo:app/);
  assert.match(script, /== 127\.0\.0\.1:3102/);
  assert.match(script, /== volume:ohana-demo_demo-data/);
  assert.ok(script.indexOf("docker image tag") < script.indexOf("compose build app"));
  assert.ok(script.indexOf("compose build app") < script.indexOf("compose stop app"));
  assert.ok(script.indexOf("compose stop app") < script.indexOf("await backup(db, target)"));
  assert.ok(script.indexOf("checkDatabase(target)") < script.indexOf("compose up -d --no-build --wait"));
  assert.deepEqual(script.match(/compose stop [^\n]+/g), ["compose stop app"]);
});
