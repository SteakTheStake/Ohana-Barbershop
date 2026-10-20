import { getCMS } from "../src/lib/cms";
import type { SQLiteAdapter } from "@payloadcms/db-sqlite";

const payload = await getCMS();
try {
  const now = new Date().toISOString();
  for (const collection of ["phone-challenges", "used-challenges", "customer-sessions", "rate-limits"] as const) {
    const result = await payload.delete({ collection, where: { expiresAt: { less_than: now } } });
    console.log(`${collection}: removed ${result.docs.length} expired records.`);
  }
} finally {
  const client = (payload.db as unknown as SQLiteAdapter).client;
  await payload.destroy();
  client.close();
}
