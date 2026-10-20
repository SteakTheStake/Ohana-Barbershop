import { APIError, type Payload, type PayloadRequest, type Where } from "payload";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { CALENDAR_TOKEN_KEY } from "./calendar";
import { normalizePhone, occupancyKeys, shopDay } from "./scheduling";
import type { Customer, Appointment } from "../payload-types";
import { expectedRevision, reliableSave } from "./reliable-save";
import { googleBusy } from "./google-calendar";
import { googleCalendarStatus } from "./google-calendar-state";

export const customerView = (c: Customer) => ({ id: c.id, name: c.name, phone: c.phone, preferences: c.preferences });
export const visitView = (a: Appointment) => ({
  id: a.id, revision: a.revision, customer: typeof a.customer === "object" ? customerView(a.customer) : { id: a.customer, name: "Customer", phone: "" },
  serviceId: typeof a.service === "object" ? a.service.id : a.service,
  serviceName: a.serviceName, startsAt: a.startsAt, endsAt: a.endsAt, priceCents: a.priceCents, status: a.status, notes: a.notes,
});
export const serviceView = (s: { id: number; name: string; priceCents: number; durationMinutes: number; bufferMinutes: number; active: boolean }) =>
  ({ id: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes, bufferMinutes: s.bufferMinutes, active: s.active });
export function recordId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new APIError("Please select a saved record.", 400);
  return id;
}
export function text(value: unknown, label: string, max: number, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max || required && result.length < 2) throw new APIError(`${label} ${required ? `must be 2-${max} characters` : `must be under ${max} characters`}.`, 400);
  return result;
}
export function phoneNumber(value: unknown) {
  try { return normalizePhone(value); } catch (error) { throw new APIError((error as Error).message, 400); }
}
export async function ownerDay(payload: Payload, req: PayloadRequest, date: string) {
  const day = shopDay(date);
  if (!day) throw new APIError("Please choose a valid date.", 400);
  const range: Where[] = [
    { startsAt: { less_than: day.plus({ days: 1 }).toUTC().toISO() } },
    { endsAt: { greater_than: day.toUTC().toISO() } },
  ];
  const [appointments, blocks, services, settings, external, calendar] = await Promise.all([
    payload.find({ collection: "appointments", req, overrideAccess: false, depth: 1, where: { and: range }, sort: "startsAt", pagination: false }),
    payload.find({ collection: "time-off", req, overrideAccess: false, where: { and: range }, sort: "startsAt", pagination: false }),
    payload.find({ collection: "services", req, overrideAccess: false, sort: "sortOrder", pagination: false }),
    payload.findGlobal({ slug: "shop-settings", req, overrideAccess: false }),
    googleBusy(date).then((events) => ({ events, error: false })).catch(() => ({ events: [], error: true })),
    googleCalendarStatus(payload, req).catch(() => null),
  ]);
  return {
    appointments: appointments.docs.map(visitView), blocks: blocks.docs, services: services.docs.map(serviceView), settings,
    externalEvents: external.events.map((event) => ({ id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.blockedUntil })),
    calendarWarning: external.error || !calendar
      ? "Google Calendar could not be checked. External bookings may be missing; new bookings are blocked until it reconnects."
      : calendar.enabled && !calendar.healthy
        ? calendar.state === "conflict"
          ? "Google Calendar overlaps an Ohana visit or time off. Resolve the conflict in your schedule; new bookings are paused."
          : "Google Calendar synchronization is pending or unavailable. New bookings are paused; check Shop for sync status."
        : null,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveVisit(payload: Payload, req: PayloadRequest, data: Record<string, unknown>) {
  const service = recordId(data.serviceId);
  const start = typeof data.startsAt === "string" ? DateTime.fromISO(data.startsAt, { setZone: true }) : null;
  if (!start?.isValid) throw new APIError("Please choose an appointment time.", 400);
  const notes = text(data.notes, "Visit notes", 1000);
  const id = data.id === undefined ? null : recordId(data.id);
  return reliableSave(payload, req, `owner:${req.user?.id}:visit`, data, async () => {
    if (id) req.context.expectedRevision = expectedRevision(data.revision);
    let customer: number;
    if (data.newCustomer && typeof data.newCustomer === "object") {
      const info = data.newCustomer as Record<string, unknown>;
      const name = text(info.name, "Customer name", 100, true);
      const phone = phoneNumber(info.phone);
      const existing = await payload.find({ collection: "customers", where: { phone: { equals: phone } }, req, overrideAccess: false, limit: 1 });
      if (existing.totalDocs) throw new APIError("That phone number is already saved. Choose Find customer and select their name.", 409);
      customer = (await payload.create({ collection: "customers", req, overrideAccess: false, data: { name, phone } })).id;
    } else customer = recordId(data.customerId);
    const visit = id
      ? await payload.update({ collection: "appointments", id, req, overrideAccess: false, depth: 1, data: { customer, service, startsAt: start.toUTC().toISO()!, notes } })
      : await payload.create({ collection: "appointments", req, overrideAccess: false, depth: 1, data: {
          customer, service, startsAt: start.toUTC().toISO()!, notes, status: "confirmed", revision: 1,
          endsAt: start.toUTC().toISO()!, blockedUntil: start.toUTC().toISO()!, serviceName: "", priceCents: 0,
        } });
    return visitView(visit);
  });
}

export async function saveVisitStatus(payload: Payload, req: PayloadRequest, data: Record<string, unknown>) {
  const status = data.status;
  if (status !== "confirmed" && status !== "completed" && status !== "no-show" && status !== "cancelled") {
    throw new APIError("Please choose a visit status.", 400);
  }
  return reliableSave(payload, req, `owner:${req.user?.id}:status`, data, async () => {
    req.context.expectedRevision = expectedRevision(data.revision);
    return visitView(await payload.update({
      collection: "appointments", id: recordId(data.id), req, overrideAccess: false, depth: 1, data: { status },
    }));
  });
}

export async function saveBlock(payload: Payload, req: PayloadRequest, data: Record<string, unknown>) {
  const reason = text(data.reason, "A short reason", 100, true);
  const start = typeof data.startsAt === "string" ? DateTime.fromISO(data.startsAt, { setZone: true }) : null;
  const end = typeof data.endsAt === "string" ? DateTime.fromISO(data.endsAt, { setZone: true }) : null;
  try { occupancyKeys(start?.toISO() ?? "", end?.toISO() ?? ""); }
  catch (error) { throw new APIError((error as Error).message, 400); }
  const dates = { reason, startsAt: start!.toUTC().toISO()!, endsAt: end!.toUTC().toISO()! };
  return data.id === undefined
    ? payload.create({ collection: "time-off", req, overrideAccess: false, data: dates })
    : payload.update({ collection: "time-off", req, overrideAccess: false, id: recordId(data.id), data: dates });
}

export async function calendarLink(payload: Payload, rotate = false) {
  let token = rotate ? null : await payload.kv.get<string>(CALENDAR_TOKEN_KEY);
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    await payload.kv.set(CALENDAR_TOKEN_KEY, token);
  }
  return { url: `${process.env.APP_URL ?? "http://localhost:3000"}/api/calendar/${token}` };
}

export async function saveSettings(payload: Payload, req: PayloadRequest, data: Record<string, unknown>) {
  if (typeof data.bookingEnabled !== "boolean" || !Array.isArray(data.weeklyHours) || data.weeklyHours.length > 7) throw new APIError("Please check your opening hours.", 400);
  const weeklyHours = data.weeklyHours.map((input) => {
    const h = input as Record<string, unknown>;
    if (!h || !/^[0-6]$/.test(String(h.weekday)) || typeof h.closed !== "boolean" ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(h.opens)) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(h.closes))) throw new APIError("Please check the opening and closing times.", 400);
    if (!h.closed && String(h.closes) <= String(h.opens)) throw new APIError("Closing time must be after opening time. Please check your working hours.", 400);
    return { weekday: String(h.weekday) as "0", closed: h.closed, opens: String(h.opens), closes: String(h.closes) };
  });
  if (data.bookingEnabled && !weeklyHours.some((h) => !h.closed)) throw new APIError("Add at least one open day before turning online booking on.", 400);
  return payload.updateGlobal({ slug: "shop-settings", req, overrideAccess: false, data: {
    bookingEnabled: data.bookingEnabled, announcement: text(data.announcement, "Your announcement", 500),
    leadMinutes: Number(data.leadMinutes), bookingDays: Number(data.bookingDays), cancellationHours: Number(data.cancellationHours), weeklyHours,
  } });
}
