import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("externalized libsql is a locked direct production app dependency", () => {
  const pkg = JSON.parse(read("apps/web/package.json"));
  assert.equal(pkg.dependencies.libsql, "0.4.7");
  const importer = read("pnpm-lock.yaml").split("  apps/web:\n")[1].split("    devDependencies:")[0];
  assert.match(importer, /\n      libsql:\n        specifier: 0\.4\.7\n        version: 0\.4\.7\n/);
});

test("Docker checks native driver resolution from the app as the runtime user", () => {
  const dockerfile = read("Dockerfile");
  const runtime = dockerfile.split(" AS runtime\n")[1];
  const command = runtime.match(/^RUN node -e "([^"\n]+)"$/m)?.[1];
  assert.ok(command, "Final image must check libsql rather than trusting the Webpack build");
  assert.ok(runtime.indexOf("USER node") < runtime.indexOf(`RUN node -e`));
  assert.ok(runtime.indexOf("WORKDIR /app/apps/web") < runtime.indexOf(`RUN node -e`));
  assert.match(command, /require\('libsql'\)/);
  assert.match(command, /SELECT 1/);
  assert.match(runtime, /^RUN node scripts\/demo-smoke\.mjs$/m);
  // Also exercise the same check against the locally installed app dependencies.
  execFileSync(process.execPath, ["-e", command], {
    cwd: fileURLToPath(new URL("apps/web/", root)),
    stdio: "pipe",
  });
});
