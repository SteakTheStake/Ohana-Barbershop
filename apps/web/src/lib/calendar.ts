import { DateTime } from "luxon";
import { site } from "./site";
import type { OwnerVisit } from "./owner-types";

export const CALENDAR_TOKEN_KEY = "calendar-feed-token";
export const icalDate = (iso: string) => DateTime.fromISO(iso, { setZone: true }).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

const escapeICS = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

// RFC 5545 folds content lines at 75 octets. Cutting only on character
// boundaries keeps multi-byte letters (like the Hawaiian ʻokina) intact.
function foldLine(line: string, limit = 74) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "", bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) { parts.push(current); current = char; bytes = size; }
    else { current += char; bytes += size; }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export type CalendarEvent = {
  uid: string; summary: string; description?: string; location?: string;
  startsAt: string; endsAt: string; stampedAt?: string | null;
};

export function calendarFeed(name: string, events: CalendarEvent[], now = DateTime.utc()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ohana Barbershop//My Shop//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(name)}`, "X-WR-TIMEZONE:America/Los_Angeles",
    "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const event of events) lines.push(
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icalDate(event.stampedAt ?? now.toISO()!)}`,
    `DTSTART:${icalDate(event.startsAt)}`,
    `DTEND:${icalDate(event.endsAt)}`,
    `SUMMARY:${escapeICS(event.summary)}`,
    ...(event.description ? [`DESCRIPTION:${escapeICS(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeICS(event.location)}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
  );
  lines.push("END:VCALENDAR");
  return lines.map((line) => foldLine(line)).join("\r\n") + "\r\n";
}

export function visitDetails(visit: Pick<OwnerVisit, "customer" | "notes">) {
  return [`Customer: ${visit.customer.name}`, `Phone: ${visit.customer.phone}`, ...(visit.notes ? [`Notes: ${visit.notes}`] : [])].join("\n");
}

export function googleEventUrl(visit: Pick<OwnerVisit, "customer" | "serviceName" | "startsAt" | "endsAt" | "notes">) {
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `${visit.serviceName} — ${visit.customer.name}`,
    dates: `${icalDate(visit.startsAt)}/${icalDate(visit.endsAt)}`,
    details: visitDetails(visit),
    location: site.address,
  })}`;
}
