import { NextRequest, NextResponse } from "next/server";
import { APIError, createLocalReq, ValidationError } from "payload";
import { getCMS } from "@/lib/cms";
import { ownerOrigin } from "@/lib/app-origins";
import { readAvailability } from "@/lib/booking-data";
import { calendarLink, ownerDay, customerView, phoneNumber, recordId, saveBlock, saveSettings, saveVisit, saveVisitStatus, serviceView, text } from "@/lib/owner-server";
import { syncGoogleCalendar } from "@/lib/google-calendar-sync";
import { googleCalendarStatus } from "@/lib/google-calendar-state";
import { CalendarBookingUnavailable } from "@/lib/google-calendar-errors";
import { DEMO_COOKIE, demoEnabled, validDemoSession } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new APIError("Please try saving again.", 415);
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  if (Number(request.headers.get("content-length")) > 16384) throw new APIError("Please shorten your notes.", 413);
  if (reader) while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new APIError("Please shorten your notes.", 413); }
    parts.push(value);
  }
  try {
    const result = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return result;
  } catch { throw new APIError("We couldn't read that form. Please try again.", 400); }
}

async function handle(request: NextRequest, context: Context) {
  try {
    if (request.method !== "GET" && request.headers.get("origin") !== ownerOrigin()) throw new APIError("Please open your shop in its usual browser address and try again.", 403);
    if (demoEnabled() && !validDemoSession(request.cookies.get(DEMO_COOKIE)?.value)) {
      return json({ error: "Enter the demo password to continue." }, 401);
    }
    const payload = await getCMS();
    const user = demoEnabled()
      ? { ...(await payload.find({ collection: "users", limit: 1 })).docs[0], collection: "users" as const }
      : (await payload.auth({ headers: request.headers })).user;
    if (!user || user.collection !== "users") return json({ error: "Please sign in to your shop." }, 401);
    const req = await createLocalReq({ user, req: { headers: request.headers } }, payload);
    const route = (await context.params).path.join("/");
    if (request.method === "GET") {
      if (route === "session") return json({ owner: { name: user.name, email: user.email }, demo: demoEnabled() });
      if (route === "calendar") return json(await calendarLink(payload));
      if (route === "calendar/google") return json(await googleCalendarStatus(payload, req));
      if (route === "appointments/history") {
        const result = await payload.find({
          collection: "appointment-history", req, overrideAccess: false, sort: "-createdAt", limit: 50,
          where: { appointmentId: { equals: recordId(request.nextUrl.searchParams.get("id")) } },
        });
        return json({ history: result.docs });
      }
      if (route === "day") return json(await ownerDay(payload, req, request.nextUrl.searchParams.get("date") ?? ""));
      if (route === "customers") {
        const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
        const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
        if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new APIError("Please choose a valid page.", 400);
        const digits = q.replace(/\D/g, "");
        const result = await payload.find({
          collection: "customers", req, overrideAccess: false, sort: "name", limit: 20, page,
          ...(q ? { where: { or: [{ name: { contains: q } }, { phone: { contains: digits.length >= 3 ? digits : q } }] } } : {}),
        });
        return json({ customers: result.docs.map(customerView), hasNextPage: result.hasNextPage, page: result.page, totalDocs: result.totalDocs });
      }
      if (route === "availability") {
        const service = await payload.findByID({ collection: "services", id: recordId(request.nextUrl.searchParams.get("service")), req, overrideAccess: false });
        const exclude = request.nextUrl.searchParams.get("appointment");
        return json({ slots: await readAvailability(payload, service, request.nextUrl.searchParams.get("date") ?? "", req, exclude ? recordId(exclude) : undefined) });
      }
      return json({ error: "That page wasn't found." }, 404);
    }
    const data = await body(request);
    if (route === "calendar/google/sync") {
      await syncGoogleCalendar(payload, true);
      return json(await googleCalendarStatus(payload, req));
    }
    if (route === "appointments/save") return json({ appointment: await saveVisit(payload, req, data) });
    if (route === "appointments/status") return json({ appointment: await saveVisitStatus(payload, req, data) });
    if (route === "customers/save") {
      const fields = { name: text(data.name, "Customer name", 100, true), phone: phoneNumber(data.phone), preferences: text(data.preferences, "Private notes", 2000) };
      const customer = data.id === undefined
        ? await payload.create({ collection: "customers", req, overrideAccess: false, data: fields })
        : await payload.update({ collection: "customers", id: recordId(data.id), req, overrideAccess: false, data: fields });
      return json({ customer: customerView(customer) });
    }
    if (route === "time-off/save") return json({ block: await saveBlock(payload, req, data) });
    if (route === "time-off/remove") {
      await payload.delete({ collection: "time-off", id: recordId(data.id), req, overrideAccess: false });
      return json({ ok: true });
    }
    if (route === "settings") return json({ settings: await saveSettings(payload, req, data) });
    if (route === "calendar/reset") return json(await calendarLink(payload, true));
    if (route === "services/save") {
      const price = typeof data.price === "string" ? data.price.trim() : "";
      if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(price) || typeof data.active !== "boolean") throw new APIError("Enter a price in dollars, such as 35 or 35.50.", 400);
      const service = await payload.update({ collection: "services", id: recordId(data.id), req, overrideAccess: false, data: {
        priceCents: Math.round(Number(price) * 100), durationMinutes: Number(data.durationMinutes), bufferMinutes: Number(data.bufferMinutes), active: data.active,
      } });
      return json({ service: serviceView(service) });
    }
    return json({ error: "That action wasn't found." }, 404);
  } catch (error) {
    if (error instanceof CalendarBookingUnavailable) return json({ error: error.message }, 503);
    if (error instanceof ValidationError) {
      const fields = error.data?.errors ?? [];
      const message = fields.some((e) => e.path === "phone" && /unique/i.test(e.message))
        ? "That phone number already belongs to another customer. Please use their existing record."
        : fields.map((e) => e.message).join(" ") || "Please check the highlighted details and try again.";
      return json({ error: message }, 400);
    }
    if (error instanceof APIError && error.status < 500) return json({ error: error.message }, error.status);
    console.error("Owner workspace request failed.");
    return json({ error: "We couldn't confirm the save. Retry the unchanged form safely, or refresh your schedule to check before making another change." }, 503);
  }
}
export const GET = handle;
export const POST = handle;
