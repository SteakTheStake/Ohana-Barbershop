import { NextRequest, NextResponse } from "next/server";
import { CalendarBookingUnavailable } from "@/lib/google-calendar-errors";
import { APIError, createLocalReq } from "payload";
import { getCMS } from "@/lib/cms";
import { readAvailability } from "@/lib/booking-data";
import { normalizePhone, SHOP_TIMEZONE, shopDay, type BookableService } from "@/lib/scheduling";
import {
  checkCode, clientAddress, currentCustomer, hash, rateLimit, RequestError,
  sendCode, SESSION_COOKIE, SESSION_SECONDS,
} from "@/lib/phone-auth";
import type { Appointment } from "@/payload-types";
import { reliableSave } from "@/lib/reliable-save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const publicAppointment = (a: Appointment) => ({
  id: a.id, serviceId: typeof a.service === "object" ? a.service.id : a.service,
  serviceName: a.serviceName, priceCents: a.priceCents, startsAt: a.startsAt, endsAt: a.endsAt,
  status: a.status, notes: a.notes,
});

async function smallBody(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 8192) throw new RequestError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new RequestError("Request is too large.", 413); }
    parts.push(value);
  }
  return Buffer.concat(parts).toString("utf8");
}

async function handle(request: NextRequest, context: Context) {
  try {
    const route = (await context.params).path.join("/");
    const payload = await getCMS();
    if (request.method === "GET") {
      if (route === "catalog") {
        const [services, settings] = await Promise.all([
          payload.find({ collection: "services", where: { active: { equals: true } }, sort: "sortOrder", pagination: false }),
          payload.findGlobal({ slug: "shop-settings" }),
        ]);
        return json({
          services: services.docs.map((s) => ({
            id: s.id, slug: s.slug, name: s.name, description: s.description,
            priceCents: s.priceCents, durationMinutes: s.durationMinutes,
          })),
          settings: { bookingEnabled: settings.bookingEnabled, announcement: settings.announcement,
            cancellationHours: settings.cancellationHours, bookingDays: settings.bookingDays, timezone: SHOP_TIMEZONE },
        });
      }
      if (route === "availability") {
        const date = request.nextUrl.searchParams.get("date") ?? "";
        const serviceId = Number(request.nextUrl.searchParams.get("service"));
        if (!shopDay(date) || !Number.isSafeInteger(serviceId) || serviceId < 1) throw new RequestError("Choose a valid service and date.");
        const service = await payload.findByID({ collection: "services", id: serviceId }).catch(() => null);
        if (!service?.active) throw new RequestError("That service is unavailable.", 404);
        return json({ slots: await readAvailability(payload, service as BookableService, date) });
      }
      if (route === "session") return json({ customer: await currentCustomer(payload, request) });
      if (route === "appointments") {
        const customer = await currentCustomer(payload, request);
        if (!customer) throw new RequestError("Please sign in with your phone.", 401);
        const result = await payload.find({
          collection: "appointments", depth: 0, sort: "-startsAt", limit: 100,
          where: { customer: { equals: customer.id } },
        });
        return json({ appointments: result.docs.map(publicAppointment) });
      }
      return json({ error: "Not found." }, 404);
    }

    const expectedOrigin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
    if (request.headers.get("origin") !== expectedOrigin) throw new RequestError("Request origin is not allowed.", 403);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new RequestError("Use application/json.", 415);
    const raw = await smallBody(request);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
      if (!data || Array.isArray(data) || typeof data !== "object") throw new Error();
    } catch { throw new RequestError("Invalid request body."); }

    if (route === "auth/send") {
      let phone: string;
      try { phone = normalizePhone(data.phone); } catch (error) { throw new RequestError((error as Error).message); }
      await rateLimit(payload, "send-ip", clientAddress(request), 10, 600);
      await rateLimit(payload, "send-phone", phone, 3, 600);
      return json(await sendCode(payload, phone));
    }
    if (route === "auth/verify") {
      await rateLimit(payload, "verify-ip", clientAddress(request), 20, 600);
      const challengeId = Number(data.challengeId);
      if (!Number.isSafeInteger(challengeId) || challengeId < 1 || typeof data.code !== "string" || !/^\d{6}$/.test(data.code)) throw new RequestError("Enter the six-digit verification code.");
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (name.length < 2 || name.length > 100) throw new RequestError("Enter your name (2-100 characters).");
      const { token, customer } = await checkCode(payload, challengeId, data.code, name);
      const response = json({ customer });
      response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
        path: "/", maxAge: SESSION_SECONDS,
      });
      return response;
    }
    if (route === "auth/logout") {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (token) await payload.delete({ collection: "customer-sessions", where: { tokenHash: { equals: hash(token) } } });
      const response = json({ ok: true });
      response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    const customer = await currentCustomer(payload, request);
    if (!customer) throw new RequestError("Please sign in with your phone.", 401);
    await rateLimit(payload, "booking", String(customer.id), 10, 60);
    if (route === "appointments") {
      const service = Number(data.serviceId);
      if (!Number.isSafeInteger(service) || service < 1 || typeof data.startsAt !== "string") throw new RequestError("Choose a service and appointment time.");
      const startsAt = data.startsAt;
      const notes = typeof data.notes === "string" ? data.notes.trim() : "";
      if (notes.length > 1000) throw new RequestError("Please keep notes under 1,000 characters.");
      const req = await createLocalReq({ context: { ohanaCustomerId: customer.id } }, payload);
      const appointment = await reliableSave(payload, req, `customer:${customer.id}:book`, data, async () => publicAppointment(await payload.create({ collection: "appointments", req, data: {
        customer: customer.id, service, startsAt, status: "confirmed", notes, revision: 1,
        // beforeValidate replaces these snapshots using the trusted service record.
        endsAt: startsAt, blockedUntil: startsAt, serviceName: "", priceCents: 0,
      } })));
      return json({ appointment }, 201);
    }
    if (route === "appointments/cancel" || route === "appointments/reschedule") {
      const id = Number(data.id);
      if (!Number.isSafeInteger(id) || id < 1) throw new RequestError("Invalid appointment.");
      const appointment = await payload.findByID({ collection: "appointments", id, depth: 0 }).catch(() => null);
      if (!appointment || appointment.customer !== customer.id) throw new RequestError("Appointment not found.", 404);
      if (route === "appointments/cancel" && appointment.status === "cancelled") return json({ appointment: publicAppointment(appointment) });
      if (appointment.status !== "confirmed") throw new RequestError("Only confirmed appointments can be changed.");
      const settings = await payload.findGlobal({ slug: "shop-settings" });
      if (Date.parse(appointment.startsAt) - Date.now() < settings.cancellationHours * 3600_000) {
        throw new RequestError(`Changes require ${settings.cancellationHours} hours' notice. Please call the shop.`, 409);
      }
      if (route.endsWith("reschedule") && typeof data.startsAt !== "string") throw new RequestError("Choose a new appointment time.");
      const updated = await payload.update({
        collection: "appointments", id,
        context: { ohanaCustomerId: customer.id },
        data: route.endsWith("cancel") ? { status: "cancelled" } : { startsAt: data.startsAt as string },
      });
      return json({ appointment: publicAppointment(updated) });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof CalendarBookingUnavailable) return json({ error: error.message }, 503);
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof APIError && error.status >= 400 && error.status < 500) return json({ error: error.message }, error.status);
    console.error("Ohana API request failed.");
    return json({ error: "We couldn't complete that request. Please try again or call the shop." }, 503);
  }
}

export const GET = handle;
export const POST = handle;
