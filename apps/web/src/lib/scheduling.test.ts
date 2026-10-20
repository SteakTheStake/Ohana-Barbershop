import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import { availableSlots, normalizePhone, occupancyKeys, shopDay, type BookableService, type BookingSettings } from "./scheduling";

const service: BookableService = { id: 1, slug: "haircut", name: "Haircut", priceCents: 3500, durationMinutes: 30, bufferMinutes: 15, active: true };
const settings: BookingSettings = {
  bookingEnabled: true, bookingDays: 90, leadMinutes: 60, cancellationHours: 24,
  weeklyHours: Array.from({ length: 7 }, (_, day) => ({ weekday: String(day), closed: false, opens: "09:00", closes: "11:00" })),
};
const now = DateTime.fromISO("2026-10-19T16:00:00Z");

test("phone numbers normalize to E.164", () => {
  assert.equal(normalizePhone("(458) 309-8765"), "+14583098765");
  assert.equal(normalizePhone("1 458 309 8765"), "+14583098765");
  assert.equal(normalizePhone("+44 7700 900123"), "+447700900123");
  for (const input of ["123", "no", {}, "+0000000000"]) assert.throws(() => normalizePhone(input));
});
test("invalid dates and closed/disabled services have no slots", () => {
  assert.equal(shopDay("2026-02-30"), null);
  assert.deepEqual(availableSlots("2026-10-20", service, { ...settings, bookingEnabled: false }, [], now), []);
  assert.deepEqual(availableSlots("2026-10-20", { ...service, active: false }, settings, [], now), []);
  assert.deepEqual(availableSlots("2026-10-18", service, settings, [], now), []);
  assert.deepEqual(availableSlots("2027-02-01", service, settings, [], now), []);
  assert.deepEqual(availableSlots("2026-10-20", service, { ...settings, weeklyHours: [] }, [], now), []);
});
test("Pacific hours, service duration, buffer and lead time are honored", () => {
  const slots = availableSlots("2026-10-19", service, settings, [], now);
  assert.equal(slots[0], "2026-10-19T17:00:00.000Z");
  assert.equal(slots.at(-1), "2026-10-19T17:15:00.000Z");
  assert.equal(slots.length, 2);
});
test("half-open overlaps permit adjacent visits, but block appointment buffers and time off", () => {
  const slots = availableSlots("2026-10-20", service, settings, [
    { startsAt: "2026-10-20T16:00:00Z", blockedUntil: "2026-10-20T16:45:00Z" },
  ], now);
  assert.equal(slots[0], "2026-10-20T16:45:00.000Z");
  assert.ok(!slots.includes("2026-10-20T16:30:00.000Z"));
});
test("DST changes keep 9am local time rather than a fixed UTC offset", () => {
  const before = availableSlots("2026-10-31", service, settings, [], now);
  const after = availableSlots("2026-11-02", service, settings, [], now);
  assert.equal(before[0], "2026-10-31T16:00:00.000Z");
  assert.equal(after[0], "2026-11-02T17:00:00.000Z");
});
test("unique lock cells cover partial intervals without overlapping adjacent aligned visits", () => {
  const first = occupancyKeys("2026-10-20T16:00:00Z", "2026-10-20T16:30:00Z");
  const adjacent = occupancyKeys("2026-10-20T16:30:00Z", "2026-10-20T17:00:00Z");
  const overlapping = occupancyKeys("2026-10-20T16:25:00Z", "2026-10-20T16:45:00Z");
  assert.equal(first.length, 6);
  assert.ok(!adjacent.some((key) => first.includes(key)));
  assert.ok(overlapping.some((key) => first.includes(key)));
  assert.throws(() => occupancyKeys("invalid", "invalid"));
  assert.throws(() => occupancyKeys("2026-10-20T16:00:00Z", "2026-10-20T15:00:00Z"));
});
