import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
const lines = [
  "# Local development only. Never commit or deploy this file.",
  `PAYLOAD_SECRET=${randomBytes(48).toString("hex")}`,
  "DATABASE_URL=file:./ohana.db",
  "APP_URL=http://localhost:3000",
  "SMS_PROVIDER=console",
  "TRUST_PROXY=false",
  "CMS_ADMIN_EMAIL=owner@ohana.local",
  `CMS_ADMIN_PASSWORD=${randomBytes(24).toString("base64url")}`,
  "",
];
try {
  writeFileSync(envPath, lines.join("\n"), { flag: "wx", mode: 0o600 });
  console.log("Created apps/web/.env.local with random secrets and owner credentials.");
  console.log("Open that local file to find your owner login, then run pnpm dev.");
  console.log("Your shop is at /owner. Online booking stays off until you confirm hours and pricing.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env.local already exists; no settings were changed.");
}
