import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCMS } from "@/lib/cms";
import { CalendarRetryLater, syncGoogleCalendar } from "@/lib/google-calendar-sync";
import { googleCalendarStatus } from "@/lib/google-calendar-state";
import { googleCalendarConfig } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

async function handle(request: NextRequest) {
  const secret = process.env.GOOGLE_CALENDAR_SYNC_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!secret || secret.length < 32 || !timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) {
    return json({ error: "Unauthorized." }, 401);
  }
  try {
    if (!googleCalendarConfig()) return json({ enabled: false, healthy: true, state: "disabled" });
    const payload = await getCMS();
    const result = request.method === "POST" ? await syncGoogleCalendar(payload) : null;
    const status = await googleCalendarStatus(payload);
    return json({
      ...result, enabled: status.enabled, healthy: status.healthy, state: status.state,
      lastSuccessAt: status.lastSync?.syncedAt ?? null, conflictCount: status.lastSync?.conflicts?.length ?? 0,
    }, status.healthy ? 200 : 503);
  } catch (error) {
    if (error instanceof CalendarRetryLater) return json({ error: error.message }, 429, { "Retry-After": String(error.seconds) });
    console.error("Google Calendar synchronization failed.");
    return json({ error: "Calendar sync failed. Retry and check the owner schedule." }, 503);
  }
}

export const GET = handle;
export const POST = handle;
