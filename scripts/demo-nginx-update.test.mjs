import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const source = readFileSync(new URL("./launch-demo-nginx.sh", import.meta.url), "utf8");
const mock = `#!/usr/bin/env bash
set -eu
name="\${0##*/}"
if [[ "$name" == docker ]]; then
  if [[ "$1" == compose ]]; then
    shift
    while [[ "$1" == --project-directory || "$1" == --env-file || "$1" == -f ]]; do shift 2; done
    echo "compose $*" >> "$MOCK_LOG"
    case "$1" in
      ps) [[ "\${MOCK_EXISTING:-1}" == 0 ]] || echo demo123 ;;
      config|exec|stop) ;;
      build) [[ "\${MOCK_BUILD_FAIL:-0}" == 0 ]] ;;
      run) [[ "\${MOCK_BACKUP_FAIL:-0}" == 0 ]] ;;
      up) [[ "\${MOCK_START_FAIL:-0}" == 0 ]] ;;
      *) exit 99 ;;
    esac
  else
    echo "docker $*" >> "$MOCK_LOG"
    case "$1" in
      info|image) ;;
      inspect)
        case "$*" in
          *Config.Labels*) echo "\${MOCK_IDENTITY:-ohana-demo:app}" ;;
          *Mounts*) echo "\${MOCK_MOUNT:-volume:ohana-demo_demo-data}" ;;
          *NetworkSettings*) echo "\${MOCK_BINDING:-127.0.0.1:3102}" ;;
          *Image*) echo sha256:previous ;;
          *) exit 98 ;;
        esac ;;
      *) exit 97 ;;
    esac
  fi
else
  echo "$name $*" >> "$MOCK_LOG"
  case "$name" in
    ss) [[ "\${MOCK_PORT_BUSY:-1}" == 0 ]] || echo LISTEN ;;
    curl)
      if [[ "$*" == *http_code* ]]; then echo 303; else echo 'Demo password'; fi ;;
    nginx|systemctl|flock) ;;
    *) exit 96 ;;
  esac
fi
`;

function run(overrides = {}) {
  const temp = mkdtempSync(path.join(os.tmpdir(), "ohana-demo-update-"));
  try {
    const repo = `${temp}/repo`;
    for (const dir of [
      "bin", "repo/scripts", "repo/deploy", "etc/nginx/sites-available",
      "etc/nginx/sites-enabled", "etc/nginx/snippets",
      "etc/letsencrypt/live/ohana-summitmc", "run/lock",
    ]) mkdirSync(`${temp}/${dir}`, { recursive: true });
    for (const name of ["docker", "curl", "ss", "nginx", "systemctl", "flock"]) {
      writeFileSync(`${temp}/bin/${name}`, mock);
      chmodSync(`${temp}/bin/${name}`, 0o755);
    }
    const site = `${temp}/etc/nginx/sites-available/ohana-summitmc.conf`;
    writeFileSync(site, "previous routing");
    symlinkSync(site, `${temp}/etc/nginx/sites-enabled/ohana-summitmc.conf`);
    for (const name of ["fullchain.pem", "privkey.pem"]) {
      writeFileSync(`${temp}/etc/letsencrypt/live/ohana-summitmc/${name}`, "test certificate");
    }
    writeFileSync(`${repo}/.env.demo`, "test-only");
    for (const name of ["nginx-demo.conf", "nginx-demo-proxy.conf"]) {
      writeFileSync(`${repo}/deploy/${name}`, `test ${name}`);
    }
    // Exercise the real workflow in a fixture; only privilege/TTY checks and
    // system paths change. All Docker/network/service commands are mocks.
    const script = source
      .replace("[[ $EUID -eq 0 ]]", "true")
      .replace("[[ -t 0 ]]", "true")
      .replaceAll("/etc/", `${temp}/etc/`)
      .replaceAll("/run/lock/", `${temp}/run/lock/`)
      .replaceAll("/var/backups/", `${temp}/var/backups/`);
    writeFileSync(`${repo}/scripts/launch-demo-nginx.sh`, script);
    writeFileSync(`${temp}/commands.log`, "");
    const result = spawnSync("bash", [`${repo}/scripts/launch-demo-nginx.sh`], {
      input: "yes\n", encoding: "utf8", timeout: 15_000,
      env: { ...process.env, PATH: `${temp}/bin:${process.env.PATH}`, MOCK_LOG: `${temp}/commands.log`, ...overrides },
    });
    return {
      ...result,
      log: readFileSync(`${temp}/commands.log`, "utf8"),
      site: readFileSync(site, "utf8"),
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("updates an existing healthy demo on its own occupied port in backup-safe order", () => {
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Demo live/);
  for (const [first, next] of [
    ["docker image tag", "compose build app"],
    ["compose build app", "compose stop app"],
    ["compose stop app", "compose run --rm --no-deps app"],
    ["compose run --rm --no-deps app", "compose up -d --no-build --wait"],
  ]) assert.ok(result.log.indexOf(first) < result.log.indexOf(next), `${first} before ${next}`);
  assert.doesNotMatch(result.log, /Health.Status|compose down|--volumes|production\.yaml/);
});

test("allows first launch on a free port and a standalone demo with no published port", () => {
  for (const options of [{ MOCK_EXISTING: "0", MOCK_PORT_BUSY: "0" }, { MOCK_PORT_BUSY: "0" }]) {
    const result = run(options);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test("refuses unrelated ports, production identities, and unexpected storage before building", () => {
  for (const options of [
    { MOCK_EXISTING: "0" },
    { MOCK_BINDING: "0.0.0.0:3102" },
    { MOCK_IDENTITY: "ohana:app" },
    { MOCK_MOUNT: "bind:/var/lib/ohana/data" },
  ]) {
    const result = run(options);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.log, /compose build|compose stop|compose up/);
    assert.equal(result.site, "previous routing");
  }
});

test("failed builds leave the running demo alone; failed backups block recreation", () => {
  const build = run({ MOCK_BUILD_FAIL: "1" });
  assert.notEqual(build.status, 0);
  assert.doesNotMatch(build.log, /compose stop|compose up/);
  assert.match(build.stderr, /Previous demo image retained/);
  const backup = run({ MOCK_BACKUP_FAIL: "1" });
  assert.notEqual(backup.status, 0);
  assert.match(backup.log, /compose stop app/);
  assert.doesNotMatch(backup.log, /compose up/);
  assert.match(backup.stderr, /No automatic image\/database rollback/);
  assert.equal(backup.site, "previous routing");
});
