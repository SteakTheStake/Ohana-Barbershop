import type { Page } from "@playwright/test";
import { DateTime } from "luxon";
import type { OwnerBlock, OwnerCustomer, OwnerDay, OwnerService, OwnerSettings, OwnerVisit } from "../../src/lib/owner-types";
import type { GoogleCalendarStatus } from "../../src/lib/google-calendar-state";

export async function mockOwner(page: Page, signedIn = true) {
  const today = DateTime.now().setZone("America/Los_Angeles").startOf("day");
  const at = (hour: number, minute = 0) => today.set({ hour, minute }).toUTC().toISO()!;
  const state = {
    signedIn,
    writes: [] as { path: string; data: Record<string, unknown> }[],
    customers: [{ id: 1, name: "Kai Morgan", phone: "+15415550100", preferences: "Usually a number 2 guard." }] as OwnerCustomer[],
    services: [
      { id: 1, name: "Haircut", priceCents: 3500, durationMinutes: 30, bufferMinutes: 0, active: true },
      { id: 2, name: "Skin Fade", priceCents: 4000, durationMinutes: 45, bufferMinutes: 5, active: true },
    ] as OwnerService[],
    settings: {
      bookingEnabled: false, announcement: "Call us to book.", leadMinutes: 60, bookingDays: 30, cancellationHours: 24,
      weeklyHours: Array.from({ length: 7 }, (_, n) => ({ weekday: String(n), closed: false, opens: "09:00", closes: "17:00" })),
    } as OwnerSettings,
    visits: [] as OwnerVisit[],
    blocks: [{ id: 21, reason: "Lunch break", startsAt: at(12, 30), endsAt: at(13) }] as OwnerBlock[],
    externalEvents: [] as NonNullable<OwnerDay["externalEvents"]>,
    calendarWarning: null as string | null,
    googleEnabled: false,
    googleLastSync: null as { syncedAt: string } | null,
    googleSyncState: "healthy" as GoogleCalendarStatus["state"],
    googleConflicts: [] as NonNullable<GoogleCalendarStatus["lastSync"]>["conflicts"],
  };
  const googleStatus = () => ({
    enabled: state.googleEnabled, healthy: Boolean(state.googleLastSync) && state.googleSyncState === "healthy", state: state.googleLastSync ? state.googleSyncState : "initializing",
    bookingMode: "link", failure: null, lastSync: state.googleLastSync ? { ...state.googleLastSync, conflicts: state.googleConflicts } : null,
  });
  state.visits = [{ id: 11, revision: 1, customer: state.customers[0], serviceId: 1, serviceName: "Haircut", priceCents: 3500, startsAt: at(10), endsAt: at(10, 30), status: "confirmed", notes: "" }];
  await page.route("**/api/users/login", async (route) => { state.signedIn = true; await route.fulfill({ json: { user: { id: 1, name: "Spencer" } } }); });
  await page.route("**/api/users/logout", async (route) => { state.signedIn = false; await route.fulfill({ json: { ok: true } }); });
  await page.route("**/api/owner/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/owner/", "");
    if (!state.signedIn) return route.fulfill({ status: 401, json: { error: "Please sign in." } });
    if (route.request().method() === "POST") {
      const data = route.request().postDataJSON() as Record<string, unknown>;
      state.writes.push({ path: endpoint, data });
      if (endpoint === "calendar/google/sync") {
        state.googleLastSync = { syncedAt: new Date().toISOString() };
        return route.fulfill({ json: googleStatus() });
      }
      if (endpoint === "appointments/save") {
        let customer = state.customers.find((c) => c.id === Number(data.customerId));
        if (data.newCustomer) {
          const details = data.newCustomer as { name: string; phone: string };
          customer = { id: 20 + state.customers.length, ...details };
          state.customers.push(customer);
        }
        const service = state.services.find((s) => s.id === Number(data.serviceId))!;
        const old = state.visits.find((v) => v.id === Number(data.id));
        const appointment: OwnerVisit = {
          id: old?.id ?? 30 + state.visits.length, revision: (old?.revision ?? 0) + 1, customer: customer!, serviceId: service.id, serviceName: service.name,
          priceCents: old?.priceCents ?? service.priceCents, startsAt: data.startsAt as string,
          endsAt: DateTime.fromISO(data.startsAt as string).plus({ minutes: service.durationMinutes }).toUTC().toISO()!,
          notes: data.notes as string, status: old?.status ?? "confirmed",
        };
        state.visits = [...state.visits.filter((v) => v.id !== appointment.id), appointment];
        return route.fulfill({ json: { appointment } });
      }
      if (endpoint === "appointments/status") {
        const appointment = state.visits.find((v) => v.id === Number(data.id))!;
        appointment.status = data.status as OwnerVisit["status"];
        appointment.revision++;
        return route.fulfill({ json: { appointment } });
      }
      if (endpoint === "time-off/save") {
        const block = { ...data, id: Number(data.id ?? 40 + state.blocks.length) } as OwnerBlock;
        state.blocks = [...state.blocks.filter((b) => b.id !== block.id), block];
        return route.fulfill({ json: { block } });
      }
      if (endpoint === "time-off/remove") {
        state.blocks = state.blocks.filter((b) => b.id !== Number(data.id));
        return route.fulfill({ json: { ok: true } });
      }
      if (endpoint === "customers/save") {
        const customer = { ...data, id: Number(data.id ?? 20 + state.customers.length) } as OwnerCustomer;
        state.customers = [...state.customers.filter((c) => c.id !== customer.id), customer];
        state.visits = state.visits.map((v) => v.customer.id === customer.id ? { ...v, customer } : v);
        return route.fulfill({ json: { customer } });
      }
      if (endpoint === "settings") { state.settings = data as OwnerSettings; return route.fulfill({ json: { settings: state.settings } }); }
      if (endpoint === "services/save") {
        const service = state.services.find((s) => s.id === Number(data.id))!;
        Object.assign(service, { priceCents: Math.round(Number(data.price) * 100), durationMinutes: Number(data.durationMinutes), bufferMinutes: Number(data.bufferMinutes), active: data.active });
        return route.fulfill({ json: { service } });
      }
    }
    if (endpoint === "session") return route.fulfill({ json: { owner: { name: "Spencer", email: "owner@ohana.test" } } });
    if (endpoint === "appointments/history") return route.fulfill({ json: { history: [] } });
    if (endpoint === "calendar") return route.fulfill({ json: { url: "https://ohana.test/api/calendar/test-only" } });
    if (endpoint === "calendar/google") return route.fulfill({ json: googleStatus() });
    if (endpoint === "day") {
      const start = DateTime.fromISO(url.searchParams.get("date")!, { zone: "America/Los_Angeles" });
      const end = start.plus({ days: 1 });
      return route.fulfill({ json: {
        appointments: state.visits.filter((v) => Date.parse(v.startsAt) < end.toMillis() && Date.parse(v.endsAt) > start.toMillis()),
        blocks: state.blocks.filter((b) => Date.parse(b.startsAt) < end.toMillis() && Date.parse(b.endsAt) > start.toMillis()),
        services: state.services, settings: state.settings, updatedAt: new Date().toISOString(),
        externalEvents: state.externalEvents, calendarWarning: state.calendarWarning,
      } });
    }
    if (endpoint === "customers") {
      const query = (url.searchParams.get("q") ?? "").toLowerCase();
      const customers = state.customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query));
      return route.fulfill({ json: { customers, page: 1, hasNextPage: false, totalDocs: customers.length } });
    }
    if (endpoint === "availability") {
      const date = DateTime.fromISO(url.searchParams.get("date")!, { zone: "America/Los_Angeles" });
      return route.fulfill({ json: { slots: [9, 9.5, 10, 10.5, 11, 13, 13.5, 14].map((h) => date.set({ hour: Math.floor(h), minute: h % 1 * 60 }).toUTC().toISO()) } });
    }
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return { state, today };
}
