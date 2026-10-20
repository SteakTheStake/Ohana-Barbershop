import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { ohanaSQLite } from "./cms/sqlite";
import { Users, Services, Customers, ShopSettings, Occupancy } from "./cms/catalog";
import { Appointments, TimeOff } from "./cms/appointments";
import { AuthRecords } from "./cms/auth-records";
import { SaveReceipts, AppointmentHistory } from "./cms/reliability";
import { services } from "./lib/site";
import { migrations } from "./migrations";
import { appOrigin, ownerOrigin } from "./lib/app-origins";
import { googleCalendarConfig } from "./lib/google-calendar";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const secret = process.env.PAYLOAD_SECRET;
if (!secret || secret.length < 32) throw new Error("Set PAYLOAD_SECRET to at least 32 random characters. Run pnpm setup:local for development.");
if (process.env.NODE_ENV === "production" && process.env.SMS_PROVIDER !== "twilio") {
  throw new Error("Production requires SMS_PROVIDER=twilio. Development phone codes are never permitted.");
}
const origins = [...new Set([appOrigin(), ownerOrigin()])];
if (process.env.NODE_ENV === "production" && origins.some((origin) => !origin.startsWith("https://"))) {
  throw new Error("APP_URL and OWNER_APP_URL must use HTTPS in production.");
}
if (process.env.NODE_ENV === "production" && googleCalendarConfig()) {
  if ((process.env.GOOGLE_CALENDAR_SYNC_SECRET?.length ?? 0) < 32) {
    throw new Error("Google Calendar requires a 32+ character sync secret in production.");
  }
  if (process.env.GOOGLE_CALENDAR_AUTO_SYNC === "false") throw new Error("Production Google Calendar requires post-commit auto sync.");
}

export default buildConfig({
  secret,
  serverURL: ownerOrigin(),
  cors: origins,
  csrf: origins,
  admin: {
    user: "users",
    theme: "dark",
    importMap: { baseDir: dirname },
    meta: { titleSuffix: " | Ohana Owner Studio" },
  },
  collections: [Users, Services, Customers, Appointments, TimeOff, Occupancy, ...AuthRecords, SaveReceipts, AppointmentHistory],
  globals: [ShopSettings],
  db: ohanaSQLite({
    client: { url: process.env.DATABASE_URL ?? "file:./ohana.db" },
    transactionOptions: { behavior: "immediate" },
    busyTimeout: 5000,
    wal: true,
    migrationDir: path.resolve(dirname, "migrations"),
    prodMigrations: migrations,
  }),
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  onInit: async (payload) => {
    const owners = await payload.count({ collection: "users" });
    if (!owners.totalDocs) {
      const email = process.env.CMS_ADMIN_EMAIL;
      const password = process.env.CMS_ADMIN_PASSWORD;
      if (!email || !password || password.length < 14) {
        throw new Error("First startup requires CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD (14+ characters). Run pnpm setup:local.");
      }
      await payload.create({ collection: "users", data: { name: "Ohana Owner", email, password } });
    }
    const catalog = await payload.count({ collection: "services" });
    if (!catalog.totalDocs) {
      for (const [sortOrder, service] of services.entries()) {
        await payload.create({ collection: "services", data: {
          slug: service.slug, name: service.name, description: service.blurb,
          priceCents: service.price * 100, durationMinutes: service.slug === "skin-fade" ? 45 : 30,
          bufferMinutes: 0, active: true, sortOrder,
        } });
      }
    }
  },
});
