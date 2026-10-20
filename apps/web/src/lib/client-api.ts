import { fetchSave, SaveUncertain } from "./save-client";

export type CustomerInfo = { id: number; name: string; phone: string };
export type ServiceInfo = { id: number; slug: string; name: string; description?: string | null; priceCents: number; durationMinutes: number };
export type AppointmentInfo = {
  id: number; serviceId: number; serviceName: string; priceCents: number;
  startsAt: string; endsAt: string; status: string; notes?: string | null;
};
export type Catalog = {
  services: ServiceInfo[];
  settings: { bookingEnabled: boolean; announcement?: string | null; cancellationHours: number; bookingDays: number; timezone: string };
};

export async function api<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetchSave(`/api/ohana/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store", signal,
  });
  const result = await response.json().catch(() => {
    if (data !== undefined) throw new SaveUncertain("We couldn't read the save confirmation. Check your account before starting again.");
    throw new Error("We couldn't load your appointments. Please refresh.");
  });
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result as T;
}

export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);
export const appointmentDate = (iso: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
}).format(new Date(iso));
export const slotTime = (iso: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit",
}).format(new Date(iso));
export const todayInShop = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const addShopDays = (isoDate: string, days: number) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * 86400_000));
export const dayButtonLabel = (isoDate: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric",
}).format(new Date(`${isoDate}T12:00:00Z`));
export function calendarHref(a: AppointmentInfo) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent([
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ohana Barbershop//Booking//EN",
    "BEGIN:VEVENT", `UID:ohana-${a.id}@ohana-barbershop.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(a.startsAt)}`, `DTEND:${stamp(a.endsAt)}`,
    `SUMMARY:${escape(`Ohana Barbershop - ${a.serviceName}`)}`,
    "LOCATION:820 Pacific Blvd SE Ste F\\, Albany\\, OR 97322",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n"))}`;
}
