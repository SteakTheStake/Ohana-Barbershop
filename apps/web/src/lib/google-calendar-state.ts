import { createHash } from "node:crypto";
import type { Payload, PayloadRequest } from "payload";
import { googleCalendarConfig, type CalendarConfig } from "./google-calendar";

export const GOOGLE_SYNC_KEY = "google-calendar-last-sync";
export const GOOGLE_FAILURE_KEY = "google-calendar-last-failure";
export const GOOGLE_SYNC_MAX_AGE_MS = 120_000;
export type CalendarRecord = {
  kind: "appointment" | "time-off"; id: number; startsAt: string; endsAt: string; summary: string; revision: string;
};
export type CalendarConflict = { recordKind: string; recordId: number; googleEventId: string; startsAt: string; endsAt: string };
export type GoogleSyncResult = {
  syncedAt: string; published: number; removed: number; namespace: string; calendarId: string;
  fingerprint: string; conflicts: CalendarConflict[];
};
export type GoogleSyncFailure = { failedAt: string; attempts: number; code: string; nextRetryAt: string };
export type GoogleCalendarStatus = {
  enabled: boolean; healthy: boolean; state: "disabled" | "initializing" | "stale" | "pending" | "error" | "conflict" | "healthy";
  bookingMode: "link" | "calendar"; lastSync: GoogleSyncResult | null; failure: GoogleSyncFailure | null;
};

export async function calendarSnapshot(payload: Payload, req?: PayloadRequest) {
  const now = new Date().toISOString();
  const [appointments, blocks] = await Promise.all([
    payload.find({ collection: "appointments", req, depth: 0, pagination: false, where: {
      and: [{ status: { not_equals: "cancelled" } }, { blockedUntil: { greater_than: now } }],
    } }),
    payload.find({ collection: "time-off", req, depth: 0, pagination: false, where: { endsAt: { greater_than: now } } }),
  ]);
  const records: CalendarRecord[] = [
    ...appointments.docs.map((a) => ({
      kind: "appointment" as const, id: a.id, startsAt: a.startsAt, endsAt: a.blockedUntil,
      summary: `Ohana - ${a.serviceName}`, revision: String(a.revision),
    })),
    ...blocks.docs.map((b) => ({
      kind: "time-off" as const, id: b.id, startsAt: b.startsAt, endsAt: b.endsAt,
      summary: "Ohana - Time off", revision: b.updatedAt,
    })),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id);
  return { records, fingerprint: createHash("sha256").update(JSON.stringify(records)).digest("hex") };
}

export async function googleCalendarStatus(payload: Payload, req?: PayloadRequest): Promise<GoogleCalendarStatus> {
  const config = googleCalendarConfig();
  if (!config) return { enabled: false, healthy: true, state: "disabled", bookingMode: "link", lastSync: null, failure: null };
  const [lastSync, failure, snapshot] = await Promise.all([
    payload.kv.get<GoogleSyncResult>(GOOGLE_SYNC_KEY),
    payload.kv.get<GoogleSyncFailure>(GOOGLE_FAILURE_KEY),
    calendarSnapshot(payload, req),
  ]);
  const age = Date.now() - Date.parse(lastSync?.syncedAt ?? "");
  let state: GoogleCalendarStatus["state"] = "healthy";
  if (!lastSync || !sameTarget(config, lastSync)) state = "initializing";
  else if (failure && Date.parse(failure.failedAt) >= Date.parse(lastSync.syncedAt)) state = "error";
  else if (!Number.isFinite(age) || age < 0 || age > GOOGLE_SYNC_MAX_AGE_MS) state = "stale";
  else if (lastSync.fingerprint !== snapshot.fingerprint) state = "pending";
  else if (lastSync.conflicts?.length) state = "conflict";
  return { enabled: true, healthy: state === "healthy", state, bookingMode: config.bookingMode ?? "link", lastSync: lastSync ?? null, failure: failure ?? null };
}

function sameTarget(config: CalendarConfig, lastSync: GoogleSyncResult) {
  return lastSync.namespace === config.namespace && lastSync.calendarId === config.calendarId;
}
