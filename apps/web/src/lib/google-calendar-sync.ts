import { randomUUID } from "node:crypto";
import type { Payload, PayloadRequest } from "payload";
import { externalBusy, GoogleCalendar, GoogleCalendarError, GoogleEventGone, googleCalendarConfig, managedEventId } from "./google-calendar";
import { SHOP_TIMEZONE, overlaps } from "./scheduling";
import { afterCommit } from "./transaction-effects";
import {
  calendarSnapshot, GOOGLE_FAILURE_KEY, GOOGLE_SYNC_KEY,
  type CalendarConflict, type GoogleSyncFailure, type GoogleSyncResult,
} from "./google-calendar-state";

export { GOOGLE_SYNC_KEY, GOOGLE_SYNC_MAX_AGE_MS } from "./google-calendar-state";
export type { GoogleSyncResult } from "./google-calendar-state";
const state = globalThis as typeof globalThis & { ohanaGoogleSync?: Promise<GoogleSyncResult> };

export class CalendarRetryLater extends Error {
  constructor(public readonly seconds: number) { super("Calendar sync is backing off after a failure."); }
}
class CalendarBindingError extends Error {}

export async function queueGoogleSync(req: PayloadRequest) {
  if (!googleCalendarConfig() || process.env.GOOGLE_CALENDAR_AUTO_SYNC === "false") return;
  await afterCommit(req, "google-calendar", () => syncGoogleCalendar(req.payload));
}

export async function syncGoogleCalendar(payload: Payload, force = false) {
  const config = googleCalendarConfig();
  if (!config) throw new Error("Google Calendar integration is disabled.");
  if (state.ohanaGoogleSync) return state.ohanaGoogleSync;
  const run = async () => {
    const failure = await payload.kv.get<GoogleSyncFailure>(GOOGLE_FAILURE_KEY);
    const remaining = Date.parse(failure?.nextRetryAt ?? "") - Date.now();
    if (!force && remaining > 0) throw new CalendarRetryLater(Math.ceil(remaining / 1000));
    try {
      const result = await reconcile(payload, new GoogleCalendar(config));
      await payload.kv.delete(GOOGLE_FAILURE_KEY);
      return result;
    } catch (error) {
      const attempts = Math.min((failure?.attempts ?? 0) + 1, 10);
      const delay = Math.max(Math.min(300, 15 * 2 ** (attempts - 1)), error instanceof GoogleCalendarError ? Math.min(86400, error.retryAfter) : 0);
      await payload.kv.set(GOOGLE_FAILURE_KEY, {
        failedAt: new Date().toISOString(), attempts,
        code: error instanceof GoogleCalendarError ? `google-${error.status}` : error instanceof CalendarBindingError ? "database-binding" : "sync-failed",
        nextRetryAt: new Date(Date.now() + delay * 1000).toISOString(),
      });
      throw error;
    }
  };
  state.ohanaGoogleSync = run();
  try { return await state.ohanaGoogleSync; }
  finally { state.ohanaGoogleSync = undefined; }
}

export async function reconcile(payload: Payload, calendar: GoogleCalendar) {
  // Reconcile committed state after every restart; no queued cancellation or
  // deleted block can be lost between a database commit and a network request.
  const { records, fingerprint } = await calendarSnapshot(payload);
  const namespace = calendar.config.namespace;
  const existing = await calendar.events({ privateExtendedProperty: `ohanaNamespace=${namespace}`, showDeleted: "false" });
  const bindingKey = "google-calendar-database-binding";
  const target = { namespace, calendarId: calendar.config.calendarId };
  const binding = await payload.kv.get<typeof target>(bindingKey);
  if (binding?.namespace !== namespace || binding?.calendarId !== target.calendarId) {
    const prior = await payload.kv.get<GoogleSyncResult>(GOOGLE_SYNC_KEY);
    if (existing.some((event) => event.extendedProperties?.private?.ohanaNamespace === namespace) &&
      (prior?.namespace !== namespace || prior?.calendarId !== target.calendarId)) {
      throw new CalendarBindingError("This calendar already contains managed events from an unrecognized database. Restore the original database or use a new calendar and namespace.");
    }
    // Persist ownership before the first write so partial first exports recover.
    await payload.kv.set(bindingKey, target);
  }
  const byId = new Map(existing.map((event) => [event.id, event]));
  const desired = new Set<string>();
  for (const record of records) {
    const baseId = managedEventId(namespace, record.kind, record.id);
    const aliasKey = `google-event-alias:${calendar.config.calendarId}:${baseId}`;
    let id = await payload.kv.get<string>(aliasKey) || baseId;
    const current = byId.get(id);
    desired.add(id);
    if (current?.extendedProperties?.private?.ohanaRevision === record.revision &&
      current.status !== "cancelled" && current.transparency !== "transparent" && current.visibility === "private" &&
      Date.parse(current.start?.dateTime ?? "") === Date.parse(record.startsAt) &&
      Date.parse(current.end?.dateTime ?? "") === Date.parse(record.endsAt) && current.summary === record.summary) continue;
    const body = {
      summary: record.summary,
      description: "Managed by Ohana. Change or cancel this entry in the Ohana owner workspace, not Google Calendar.",
      start: { dateTime: record.startsAt, timeZone: SHOP_TIMEZONE },
      end: { dateTime: record.endsAt, timeZone: SHOP_TIMEZONE },
      status: "confirmed", transparency: "opaque", visibility: "private",
      extendedProperties: { private: { ohanaNamespace: namespace, ohanaRevision: record.revision } },
    };
    try { await calendar.upsert(id, body); }
    catch (error) {
      if (!(error instanceof GoogleEventGone)) throw error;
      // Persist the replacement before insertion to survive lost responses.
      desired.delete(id);
      id = managedEventId(`${namespace}:${randomUUID()}`, record.kind, record.id);
      await payload.kv.set(aliasKey, id);
      desired.add(id);
      await calendar.upsert(id, body);
    }
  }
  let removed = 0;
  // Never alter Rosie/manual events, even if Google returns an unexpected item.
  // Keep historical events; remove only future entries no longer in Ohana.
  for (const event of existing) {
    if (event.extendedProperties?.private?.ohanaNamespace !== namespace || desired.has(event.id) ||
      event.status === "cancelled" || Date.parse(event.end?.dateTime ?? "") <= Date.now()) continue;
    if (!event.end?.dateTime || !Number.isFinite(Date.parse(event.end.dateTime))) throw new Error("Invalid managed Google Calendar event.");
    await calendar.cancel(event.id, event.etag);
    removed++;
  }
  const conflicts: CalendarConflict[] = [];
  if (records.length) {
    const start = Math.min(...records.map((record) => Date.parse(record.startsAt)));
    const end = Math.max(...records.map((record) => Date.parse(record.endsAt)));
    const external = externalBusy(await calendar.events({
      timeMin: new Date(start).toISOString(), timeMax: new Date(end).toISOString(),
      singleEvents: "true", showDeleted: "false", timeZone: SHOP_TIMEZONE,
    }), namespace);
    for (const record of records) {
      for (const event of external) {
        if (overlaps(Date.parse(record.startsAt), Date.parse(record.endsAt), Date.parse(event.startsAt), Date.parse(event.blockedUntil))) {
          conflicts.push({ recordKind: record.kind, recordId: record.id, googleEventId: event.id, startsAt: record.startsAt, endsAt: record.endsAt });
        }
      }
    }
  }
  const result = { syncedAt: new Date().toISOString(), published: records.length, removed, namespace, calendarId: calendar.config.calendarId, fingerprint, conflicts };
  await payload.kv.set(GOOGLE_SYNC_KEY, result);
  if (conflicts.length) console.error(`Google Calendar has ${conflicts.length} unresolved scheduling conflicts. Check the owner workspace.`);
  return result;
}
