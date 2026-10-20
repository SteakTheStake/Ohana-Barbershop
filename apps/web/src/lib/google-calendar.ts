import { createHash, createPrivateKey, createSign } from "node:crypto";
import { DateTime } from "luxon";
import { SHOP_TIMEZONE, type BusyRange } from "./scheduling";

const API = "https://www.googleapis.com/calendar/v3/calendars/";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  visibility?: string;
  etag?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
};
export type GoogleBusyEvent = BusyRange & { id: string; title: string };
export type CalendarConfig = { calendarId: string; email: string; privateKey: string; namespace: string; bookingMode?: "link" | "calendar" };

export function googleCalendarConfig(): CalendarConfig | null {
  const enabled = process.env.GOOGLE_CALENDAR_ENABLED;
  if (!enabled || enabled === "false") return null;
  if (enabled !== "true") throw new Error("GOOGLE_CALENDAR_ENABLED must be true or false.");
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const namespace = process.env.GOOGLE_CALENDAR_NAMESPACE;
  if (!calendarId || calendarId === "primary" || !email || !privateKey || !namespace || !/^[a-zA-Z0-9_-]{16,100}$/.test(namespace)) {
    throw new Error("Configure a dedicated Google calendar, service account credentials and a unique calendar namespace.");
  }
  const bookingMode = process.env.ROSIE_BOOKING_MODE ?? "link";
  if (bookingMode !== "link" && bookingMode !== "calendar") throw new Error("ROSIE_BOOKING_MODE must be link or calendar.");
  if (bookingMode === "calendar" && process.env.ROSIE_ACCEPT_NONATOMIC_BOOKINGS !== "true") {
    throw new Error("Direct Google booking requires explicit acceptance of non-atomic bookings. Use Rosie booking links for the safe default.");
  }
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error("Google Calendar requires an RSA private key of at least 2048 bits.");
  }
  return { calendarId, email, privateKey, namespace, bookingMode };
}

export class GoogleCalendarError extends Error {
  constructor(public readonly status: number, public readonly retryAfter = 0) {
    super("Google Calendar is unavailable. Please try again or call the shop.");
  }
}

export class GoogleEventGone extends Error {}

// One client per operation keeps credentials/tokens out of persistent storage.
export class GoogleCalendar {
  private token?: string;
  constructor(
    readonly config: CalendarConfig,
    private readonly transport: typeof fetch = fetch,
    private readonly deadline = Date.now() + 55_000,
  ) {}

  private async fetchWithRetry(url: string, init: RequestInit) {
    for (let attempt = 0; ; attempt++) {
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) throw new GoogleCalendarError(504);
      let response: Response;
      try {
        response = await this.transport(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(Math.min(10_000, remaining)) });
      } catch {
        if (attempt >= 2) throw new GoogleCalendarError(503);
        await this.pause(250 * 2 ** attempt);
        continue;
      }
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= 2) return response;
      const retryAfter = response.headers.get("retry-after");
      const seconds = Number(retryAfter);
      const delay = retryAfter && !Number.isFinite(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
      if (delay > 2000) throw new GoogleCalendarError(response.status, Math.ceil(delay / 1000));
      await response.body?.cancel();
      await this.pause(Math.max(250 * 2 ** attempt, Number.isFinite(delay) ? delay : 0));
    }
  }

  private async pause(delay: number) {
    if (Date.now() + delay >= this.deadline) throw new GoogleCalendarError(504);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async accessToken() {
    if (this.token) return this.token;
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
      iss: this.config.email, scope: "https://www.googleapis.com/auth/calendar.events",
      aud: TOKEN_URL, iat: now, exp: now + 3600,
    })}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(this.config.privateKey, "base64url")}`;
    const response = await this.fetchWithRetry(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    if (!response.ok) throw new GoogleCalendarError(response.status);
    const body = await response.json();
    if (typeof body.access_token !== "string" || !body.access_token) throw new GoogleCalendarError(502);
    this.token = body.access_token;
    return this.token;
  }

  private async request(path: string, init: RequestInit = {}) {
    const execute = async () => this.fetchWithRetry(`${API}${encodeURIComponent(this.config.calendarId)}/events${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
    });
    let response = await execute();
    if (response.status === 401) {
      await response.body?.cancel();
      this.token = undefined;
      response = await execute();
    }
    return response;
  }

  async events(params: Record<string, string>): Promise<GoogleEvent[]> {
    const events: GoogleEvent[] = [];
    const seen = new Set<string>();
    let page = "";
    do {
      if (seen.size >= 100) throw new GoogleCalendarError(502);
      const query = new URLSearchParams({ maxResults: "2500", ...params, ...(page ? { pageToken: page } : {}) });
      const response = await this.request(`?${query}`);
      if (!response.ok) throw new GoogleCalendarError(response.status);
      const body = await response.json();
      if (body.items !== undefined && !Array.isArray(body.items) || body.items === undefined && body.kind !== "calendar#events") {
        throw new GoogleCalendarError(502);
      }
      events.push(...body.items ?? []);
      page = body.nextPageToken ?? "";
      if (typeof page !== "string" || page && seen.has(page)) throw new GoogleCalendarError(502);
      seen.add(page);
    } while (page);
    return events;
  }

  async busy(date: string): Promise<GoogleBusyEvent[]> {
    const day = DateTime.fromISO(date, { zone: SHOP_TIMEZONE }).startOf("day");
    if (!day.isValid) throw new Error("Choose a valid calendar date.");
    const events = await this.events({
      timeMin: day.toUTC().toISO()!, timeMax: day.plus({ days: 1 }).toUTC().toISO()!,
      singleEvents: "true", showDeleted: "false", timeZone: SHOP_TIMEZONE,
    });
    return externalBusy(events, this.config.namespace);
  }

  async upsert(id: string, body: Record<string, unknown>) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await this.request(`/${encodeURIComponent(id)}`);
      if (current.status === 410) throw new GoogleEventGone();
      if (current.status === 404) {
        const inserted = await this.request("?sendUpdates=none", { method: "POST", body: JSON.stringify({ ...body, id }) });
        if (inserted.ok) return;
        if (inserted.status === 409 && attempt === 0) continue;
        if (inserted.status === 410) throw new GoogleEventGone();
        throw new GoogleCalendarError(inserted.status);
      }
      if (!current.ok) throw new GoogleCalendarError(current.status);
      const event = await current.json() as GoogleEvent;
      if (event.status === "cancelled") throw new GoogleEventGone();
      if (event.id !== id || event.extendedProperties?.private?.ohanaNamespace !== this.config.namespace) {
        throw new GoogleCalendarError(409);
      }
      const response = await this.request(`/${encodeURIComponent(id)}?sendUpdates=none`, {
        method: "PATCH", body: JSON.stringify(body), headers: event.etag ? { "If-Match": event.etag } : {},
      });
      if (response.ok) return;
      if (response.status === 410) throw new GoogleEventGone();
      throw new GoogleCalendarError(response.status);
    }
  }

  async cancel(id: string, etag?: string) {
    const response = await this.request(`/${encodeURIComponent(id)}?sendUpdates=none`, {
      method: "PATCH", body: JSON.stringify({ status: "cancelled" }), headers: etag ? { "If-Match": etag } : {},
    });
    if (!response.ok && response.status !== 404 && response.status !== 410) throw new GoogleCalendarError(response.status);
  }
}

export function managedEventId(namespace: string, kind: string, id: number) {
  return createHash("sha256").update(`${namespace}:${kind}:${id}`).digest("hex");
}

export function externalBusy(events: GoogleEvent[], namespace: string): GoogleBusyEvent[] {
  return events.flatMap((event) => {
    if (event.status === "cancelled" || event.transparency === "transparent" ||
      event.extendedProperties?.private?.ohanaNamespace === namespace) return [];
    const parse = (value: GoogleEvent["start"]) => {
      if (value?.dateTime) return DateTime.fromISO(value.dateTime, { zone: value.timeZone ?? SHOP_TIMEZONE });
      return DateTime.fromISO(value?.date ?? "", { zone: SHOP_TIMEZONE }).startOf("day");
    };
    const start = parse(event.start), end = parse(event.end);
    // An unreadable busy event must not silently turn into free time.
    if (!event.id || !start.isValid || !end.isValid || end <= start) throw new GoogleCalendarError(502);
    return [{ id: event.id, title: event.summary || "Google Calendar booking", startsAt: start.toUTC().toISO()!, blockedUntil: end.toUTC().toISO()! }];
  });
}

export async function googleBusy(date: string) {
  const config = googleCalendarConfig();
  return config ? new GoogleCalendar(config).busy(date) : [];
}
