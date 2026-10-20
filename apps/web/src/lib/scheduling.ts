import { DateTime } from "luxon";

export const SHOP_TIMEZONE = "America/Los_Angeles";
export const SLOT_MINUTES = 15;
export const LOCK_MINUTES = 5;
export const MAX_BLOCK_DAYS = 31;

export type BookableService = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  priceCents: number;
  durationMinutes: number;
  bufferMinutes: number;
  active: boolean;
};
export type BookingSettings = {
  bookingEnabled: boolean;
  leadMinutes: number;
  bookingDays: number;
  cancellationHours: number;
  weeklyHours?: {
    weekday: string;
    closed?: boolean | null;
    opens: string;
    closes: string;
  }[] | null;
};
export type BusyRange = { startsAt: string; blockedUntil: string };

export function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && end > otherStart;
}

export function shopDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = DateTime.fromISO(date, { zone: SHOP_TIMEZONE });
  return day.isValid && day.toISODate() === date ? day.startOf("day") : null;
}

export function availableSlots(
  date: string,
  service: BookableService,
  settings: BookingSettings,
  busy: BusyRange[],
  now: DateTime = DateTime.utc(),
): string[] {
  const day = shopDay(date);
  if (!day || !settings.bookingEnabled || !service.active) return [];
  const today = now.setZone(SHOP_TIMEZONE).startOf("day");
  if (day < today || day > today.plus({ days: settings.bookingDays })) return [];
  const hours = settings.weeklyHours?.find((h) => Number(h.weekday) === day.weekday % 7);
  if (!hours || hours.closed) return [];
  const open = DateTime.fromISO(`${date}T${hours.opens}`, { zone: SHOP_TIMEZONE });
  const close = DateTime.fromISO(`${date}T${hours.closes}`, { zone: SHOP_TIMEZONE });
  if (!open.isValid || !close.isValid || close <= open) return [];
  const first = open.plus({ minutes: (SLOT_MINUTES - open.minute % SLOT_MINUTES) % SLOT_MINUTES });
  const earliest = now.plus({ minutes: settings.leadMinutes });
  const slots: string[] = [];
  for (let start = first; start < close; start = start.plus({ minutes: SLOT_MINUTES })) {
    const end = start.plus({ minutes: service.durationMinutes + service.bufferMinutes });
    if (end > close || start < earliest) continue;
    if (busy.some((b) => overlaps(start.toMillis(), end.toMillis(), Date.parse(b.startsAt), Date.parse(b.blockedUntil)))) continue;
    slots.push(start.toUTC().toISO()!);
  }
  return slots;
}

// A unique database row per five-minute cell makes overlapping bookings conflict
// inside the same transaction, including concurrent requests and admin edits.
export function occupancyKeys(startsAt: string, endsAt: string): string[] {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const step = LOCK_MINUTES * 60_000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_BLOCK_DAYS * 86400_000 + 3600_000) {
    throw new Error("Choose an end after the start, with no more than 31 days blocked at once.");
  }
  const keys: string[] = [];
  for (let t = Math.floor(start / step) * step; t < end; t += step) keys.push(String(t));
  return keys;
}

export function normalizePhone(input: unknown): string {
  if (typeof input !== "string" || input.length > 40) throw new Error("Enter a valid phone number.");
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  const phone = trimmed.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : "";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Use a 10-digit US number or international number starting with +.");
  return phone;
}
