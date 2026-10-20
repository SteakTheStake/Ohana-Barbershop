import { expect, test } from "@playwright/test";
import { mockOwner } from "./owner-fixture";

test("Rosie entries are visible but read-only, with a clear external calendar outage warning", async ({ page }) => {
  const { state, today } = await mockOwner(page);
  state.externalEvents = [{
    id: "rosie-booking", title: "Rosie haircut", startsAt: today.set({ hour: 14 }).toUTC().toISO()!,
    endsAt: today.set({ hour: 14, minute: 30 }).toUTC().toISO()!,
  }];
  await page.goto("/owner");
  await expect(page.getByText("Rosie haircut", { exact: true })).toBeVisible();
  await expect(page.getByText(/Manage in Rosie or Google Calendar/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Rosie haircut/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  state.calendarWarning = "Google Calendar could not be checked. External bookings may be missing; new bookings are blocked until it reconnects.";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Google Calendar could not be checked" })).toBeVisible();
  await expect(page.getByText("Kai Morgan", { exact: true })).toBeVisible();
});

test("owner can sync the connected Google calendar and see the last success", async ({ page }) => {
  const { state } = await mockOwner(page);
  state.googleEnabled = true;
  await page.goto("/owner");
  await page.getByRole("navigation", { name: "Shop navigation" }).getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page.getByText("No successful sync yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sync Google Calendar now", exact: true }).click();
  await expect(page.getByText(/Last successful sync:/)).toBeVisible();
  expect(state.writes.filter((write) => write.path === "calendar/google/sync")).toHaveLength(1);
  await expect(page.getByRole("heading", { name: "Read-only calendar subscription" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("owner sees unresolved conflicts and the booking pause without exposing edit controls for Rosie entries", async ({ page }) => {
  const { state, today } = await mockOwner(page);
  state.googleEnabled = true;
  state.googleLastSync = { syncedAt: new Date().toISOString() };
  state.googleSyncState = "conflict";
  state.googleConflicts = [{
    recordKind: "appointment", recordId: 11, googleEventId: "private-google-id",
    startsAt: today.set({ hour: 10 }).toUTC().toISO()!, endsAt: today.set({ hour: 10, minute: 30 }).toUTC().toISO()!,
  }];
  await page.goto("/owner");
  await page.getByRole("navigation", { name: "Shop navigation" }).getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Scheduling conflicts need attention" })).toBeVisible();
  await expect(page.getByText(/Visit #11.*overlaps a Google booking/)).toBeVisible();
  await expect(page.getByText(/New Ohana bookings are paused/)).toBeVisible();
  await expect(page.getByText("private-google-id", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
