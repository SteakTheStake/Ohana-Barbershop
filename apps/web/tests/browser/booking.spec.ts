import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";

test("native booking, phone login and confirmation work without horizontal overflow", async ({ page }, testInfo) => {
  const start = DateTime.now().setZone("America/Los_Angeles").plus({ days: 4 }).startOf("day").set({ hour: 9 });
  const startsAt = start.toUTC().toISO()!;
  const service = { id: 1, slug: "haircut", name: "Haircut", description: "Classic cut, your way.", durationMinutes: 30, priceCents: 3500 };
  const appointment = { id: 1, serviceId: 1, serviceName: "Haircut", startsAt, endsAt: new Date(Date.parse(startsAt) + 1800_000).toISOString(), priceCents: 3500, status: "confirmed" };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/ohana/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const response = path.endsWith("/catalog")
      ? { services: [service], settings: { bookingEnabled: true, cancellationHours: 24, bookingDays: 30, timezone: "America/Los_Angeles" } }
      : path.endsWith("/session") ? { customer: null }
      : path.endsWith("/availability") ? { slots: [startsAt] }
      : path.endsWith("/auth/send") ? { challengeId: 1, developmentCode: "123456" }
      : path.endsWith("/auth/verify") ? { customer: { id: 1, name: "Test Ohana", phone: "+15415550100" } }
      : { appointment };
    await route.fulfill({ json: response });
  });
  await page.goto("/book?service=haircut");
  await expect(page.getByRole("heading", { name: "Your Chair Is Waiting." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Haircut.*35/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: start.toFormat("ccc, LLL d") }).click();
  const time = page.locator(".slot-choice").first();
  await expect(time).toBeVisible();
  await time.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("booking.png"), fullPage: true });
  await page.getByLabel("Mobile phone").fill("5415550100");
  await page.getByRole("button", { name: "Text me a code" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Test Ohana");
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify & sign in" }).click();
  await page.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(page.getByRole("heading", { name: "See You In The Chair." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to calendar" })).toHaveAttribute("download", "ohana-1.ics");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("owner login page is reachable and customer login remains separate", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("textbox", { name: /^Email/ })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "My Ohana" })).toBeVisible();
  await expect(page.getByLabel("Mobile phone")).toBeVisible();
});

test("customers can reschedule and cancel from their account", async ({ page }) => {
  let appointment = {
    id: 2, serviceId: 1, serviceName: "Haircut", priceCents: 3500, status: "confirmed",
    startsAt: new Date(Date.now() + 4 * 86400_000).toISOString(),
    endsAt: new Date(Date.now() + 4 * 86400_000 + 1800_000).toISOString(),
  };
  const next = new Date(Date.now() + 5 * 86400_000).toISOString();
  await page.route("**/api/ohana/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname;
    if (endpoint.endsWith("/appointments/reschedule")) {
      appointment = { ...appointment, startsAt: next };
      return route.fulfill({ json: { appointment } });
    }
    if (endpoint.endsWith("/appointments/cancel")) {
      appointment = { ...appointment, status: "cancelled" };
      return route.fulfill({ json: { appointment } });
    }
    const response = endpoint.endsWith("/session")
      ? { customer: { id: 1, name: "Test Ohana", phone: "+15415550100" } }
      : endpoint.endsWith("/catalog") ? { services: [], settings: { bookingEnabled: true, cancellationHours: 24, bookingDays: 30 } }
      : endpoint.endsWith("/availability") ? { slots: [next] }
      : { appointments: [appointment] };
    await route.fulfill({ json: response });
  });
  await page.goto("/account");
  await page.getByRole("button", { name: "Change time" }).click();
  await page.locator(".slot-choice").first().click();
  await page.getByRole("button", { name: "Confirm new time" }).click();
  await expect(page.getByText("Your original time stays reserved", { exact: false })).not.toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel visit" }).click();
  await expect(page.getByText("cancelled / #2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel visit" })).not.toBeVisible();
});
