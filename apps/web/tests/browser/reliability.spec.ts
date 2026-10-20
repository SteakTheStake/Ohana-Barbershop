import { expect, test } from "@playwright/test";
import { mockOwner } from "./owner-fixture";

test("uncertain booking retries the original request without exposing editable details", async ({ page }) => {
  await mockOwner(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/owner/appointments/save", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length <= 2) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    const data = bodies[0];
    return route.fulfill({ json: { appointment: {
      id: 99, revision: 1, customer: { id: 1, name: "Kai Morgan", phone: "+15415550100" },
      serviceId: 1, serviceName: "Haircut", priceCents: 3500, status: "confirmed",
      startsAt: data.startsAt, endsAt: data.startsAt, notes: data.notes,
    } } });
  });
  await page.goto("/owner");
  await page.getByRole("button", { name: "Book a cut", exact: true }).click();
  await page.getByLabel("Find by name or phone").fill("Kai");
  await page.getByRole("button", { name: /Kai Morgan.*Choose/ }).click();
  await page.getByRole("button", { name: "9:30 AM", exact: true }).click();
  await page.getByRole("button", { name: "Book this cut" }).click();
  await expect(page.getByRole("heading", { name: "Check the last save before changing anything" })).toBeVisible();
  await expect(page.getByLabel("Visit notes", { exact: false })).not.toBeVisible();
  await page.getByRole("button", { name: "Check saved visit safely" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(bodies).toHaveLength(3);
  expect(bodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2]).toEqual(bodies[0]);
});

test("offline and failed refreshes never leave a seemingly live schedule", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/owner");
  await expect(page.locator(".studio-visit-main")).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByText("You're offline.", { exact: true })).toBeVisible();
  await page.route("**/api/owner/day?**", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("online"));
  });
  await expect(page.getByText("Your schedule may be out of date.", { exact: true })).toBeVisible();
  await expect(page.locator(".studio-visit-main")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Print day" })).toBeVisible();
});

test("printed schedule includes contact numbers without app controls", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/owner");
  await expect(page.locator(".studio-visit-main")).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".studio-print-only")).toHaveText("Phone: +15415550100");
  await expect(page.locator(".studio-print-only")).toBeVisible();
  await expect(page.locator(".studio-header")).not.toBeVisible();
  await expect(page.locator(".studio-nav")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Print day" })).not.toBeVisible();
});
