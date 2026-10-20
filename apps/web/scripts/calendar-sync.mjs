import { pathToFileURL } from "node:url";

export async function runCalendarSync({ env = process.env, transport = fetch, check = false, log = console.log } = {}) {
  if (!env.GOOGLE_CALENDAR_ENABLED || env.GOOGLE_CALENDAR_ENABLED === "false") return 0;
  if (env.GOOGLE_CALENDAR_ENABLED !== "true" || (env.GOOGLE_CALENDAR_SYNC_SECRET?.length ?? 0) < 32) {
    log("Calendar sync configuration is incomplete.");
    return 1;
  }
  try {
    // Only call the running app. This worker never opens the SQLite database.
    const response = await transport("http://127.0.0.1:3000/api/calendar-sync", {
      method: check ? "GET" : "POST", signal: AbortSignal.timeout(65_000),
      headers: { Authorization: `Bearer ${env.GOOGLE_CALENDAR_SYNC_SECRET}` },
    });
    if (!response.ok) {
      log(`Calendar ${check ? "health check" : "sync"} failed (HTTP ${response.status}). Check the owner workspace.`);
      return 1;
    }
    const result = await response.json();
    if (result.healthy !== true) { log("Calendar needs attention in the owner workspace."); return 1; }
    log(`Calendar ${check ? "health" : "sync"}: ${result.state}; ${Number(result.conflictCount ?? 0)} conflicts.`);
    return 0;
  } catch {
    log("Calendar sync could not reach the running app.");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).some((arg) => arg !== "--check")) {
    console.error("Usage: node scripts/calendar-sync.mjs [--check]");
    process.exitCode = 1;
  } else process.exitCode = await runCalendarSync({ check: process.argv.includes("--check") });
}
