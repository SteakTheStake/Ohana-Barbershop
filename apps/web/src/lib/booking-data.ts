import type { Payload, PayloadRequest } from "payload";
import { DateTime } from "luxon";
import { availableSlots, shopDay, type BookableService, type BookingSettings } from "./scheduling";
import { googleBusy } from "./google-calendar";
import { googleCalendarStatus } from "./google-calendar-state";
import { CalendarBookingUnavailable } from "./google-calendar-errors";

export async function readAvailability(
  payload: Payload,
  service: BookableService,
  date: string,
  req?: PayloadRequest,
  excludeAppointment?: number,
) {
  const day = shopDay(date);
  if (!day) return [];
  const calendar = await googleCalendarStatus(payload, req);
  const ownerResolvingConflict = calendar.state === "conflict" && req?.user?.collection === "users" && excludeAppointment;
  if (calendar.enabled && !calendar.healthy && !ownerResolvingConflict) {
    throw new CalendarBookingUnavailable(calendar.state);
  }
  const settings = await payload.findGlobal({ slug: "shop-settings", req }) as BookingSettings;
  const [appointments, timeOff, external] = await Promise.all([
    payload.find({
      collection: "appointments", req, depth: 0, pagination: false,
      where: { and: [
        { status: { not_equals: "cancelled" } },
        { startsAt: { less_than: day.plus({ days: 1 }).toUTC().toISO() } },
        { blockedUntil: { greater_than: day.toUTC().toISO() } },
        ...(excludeAppointment ? [{ id: { not_equals: excludeAppointment } }] : []),
      ] },
    }),
    payload.find({
      collection: "time-off", req, depth: 0, pagination: false,
      where: { and: [
        { startsAt: { less_than: day.plus({ days: 1 }).toUTC().toISO() } },
        { endsAt: { greater_than: day.toUTC().toISO() } },
      ] },
    }),
    googleBusy(date),
  ]);
  const effectiveSettings = {
    ...settings,
    bookingEnabled: settings.bookingEnabled || req?.user?.collection === "users",
    ...(req?.user?.collection === "users" ? { leadMinutes: 0, bookingDays: 365 } : {}),
  };
  return availableSlots(date, service, effectiveSettings, [
    ...appointments.docs.map((a) => ({ startsAt: a.startsAt, blockedUntil: a.blockedUntil })),
    ...timeOff.docs.map((t) => ({ startsAt: t.startsAt, blockedUntil: t.endsAt })),
    ...external,
  ], DateTime.utc());
}
