import { expect, test } from "@playwright/test";
import { mockOwner } from "./owner-fixture";

test("barber signs in and books a new customer with touch-friendly controls", async ({ page }, testInfo) => {
  const { state } = await mockOwner(page, false);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/owner");
  await page.getByLabel("Email", { exact: true }).fill("owner@ohana.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-owner-password");
  await page.getByRole("button", { name: "Open my shop" }).click();
  await expect(page.getByRole("button", { name: /Kai Morgan/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("owner-schedule.png"), fullPage: true });
  await page.getByRole("button", { name: "Book a cut", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "New customer", exact: true }).click();
  await page.getByLabel("Customer name", { exact: true }).fill("Leilani Test");
  await page.getByLabel("Mobile phone", { exact: true }).fill("5415550199");
  await page.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Close form", exact: true })).toBeInViewport();
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("owner-book-cut.png"), fullPage: true });
  await page.getByRole("button", { name: "Book this cut" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Leilani Test", { exact: true })).toBeVisible();
  expect(state.writes.find((w) => w.path === "appointments/save")?.data.newCustomer).toEqual({ name: "Leilani Test", phone: "5415550199" });
  expect(errors).toEqual([]);
});

test("barber edits a visit, marks it done, undoes done, and cancels clearly", async ({ page }) => {
  const { state } = await mockOwner(page);
  await page.goto("/owner");
  await page.locator(".studio-visit-main").first().click();
  await page.getByLabel("Visit notes", { exact: false }).fill("A little shorter on top");
  await page.getByRole("button", { name: "10:30 AM", exact: true }).click();
  await page.getByRole("button", { name: "Save visit changes" }).click();
  await expect(page.getByText(/Until.*A little shorter on top/)).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo done" })).toBeVisible();
  await page.getByRole("button", { name: "Undo done" }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await page.locator(".studio-visit-main").first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel this visit" }).click();
  await expect(page.getByText("1 cancelled visit", { exact: true })).toBeVisible();
  expect(state.visits[0].status).toBe("cancelled");
});

test("barber blocks a quick break, removes it, and books multiple days away", async ({ page }) => {
  const { state, today } = await mockOwner(page);
  await page.goto("/owner");
  await page.getByRole("button", { name: "Block time", exact: true }).click();
  await page.getByLabel("What is this time for?").fill("School pickup");
  await page.getByLabel("Start time", { exact: true }).fill("14:00");
  await page.getByRole("button", { name: "1 hour", exact: true }).click();
  await page.getByRole("button", { name: "Block this time" }).click();
  await expect(page.getByText("School pickup", { exact: true })).toBeVisible();
  const block = state.blocks.find((b) => b.reason === "School pickup")!;
  expect(Date.parse(block.endsAt) - Date.parse(block.startsAt)).toBe(3600_000);
  await page.getByRole("button", { name: /School pickup/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove this blocked time" }).click();
  await expect(page.getByText("School pickup", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Block time", exact: true }).click();
  await page.getByRole("button", { name: "Time off / days away", exact: true }).click();
  await page.getByLabel("What is this time for?").fill("Vacation");
  await page.getByLabel("First day away", { exact: true }).fill(today.plus({ days: 5 }).toISODate()!);
  await page.getByLabel("Last day away (included)", { exact: true }).fill(today.plus({ days: 12 }).toISODate()!);
  await page.getByRole("button", { name: "Block this time" }).click();
  await expect(page.getByText("Vacation", { exact: true })).toBeVisible();
  const vacation = state.blocks.find((b) => b.reason === "Vacation")!;
  expect(vacation.endsAt).toBe(today.plus({ days: 13 }).toUTC().toISO());
});

test("barber finds a customer, edits private notes and phone, then changes shop hours and prices", async ({ page }) => {
  const { state } = await mockOwner(page);
  await page.goto("/owner");
  await page.getByRole("navigation", { name: "Shop navigation" }).getByRole("button", { name: "Customers", exact: true }).click();
  await page.getByLabel("Search by name or phone").fill("Kai");
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Customer name", { exact: true }).fill("Kai Morgan Jr.");
  await page.getByLabel("Mobile phone", { exact: true }).fill("5415550188");
  await page.getByLabel("Notes just for you", { exact: false }).fill("Number 2 guard. Likes a quiet appointment.");
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  await expect(page.getByText("Kai Morgan Jr.", { exact: true })).toBeVisible();
  expect(state.customers[0].preferences).toContain("quiet appointment");
  await page.getByRole("navigation", { name: "Shop navigation" }).getByRole("button", { name: "Shop", exact: true }).click();
  await page.getByLabel("Tuesday opens", { exact: true }).fill("10:00");
  await page.getByRole("button", { name: "Save shop settings", exact: true }).click();
  await expect(page.getByText("Your shop settings are saved.", { exact: true })).toBeVisible();
  expect(state.settings.weeklyHours?.find((h) => h.weekday === "2")?.opens).toBe("10:00");
  await page.getByRole("button", { name: /Haircut.*Edit/ }).click();
  await page.getByLabel("Price in dollars", { exact: true }).fill("40.50");
  await page.getByLabel("Time for the cut", { exact: false }).fill("45");
  await page.getByRole("button", { name: "Save service", exact: true }).click();
  await expect(page.getByText("$40.50", { exact: true })).toBeVisible();
  expect(state.services[0].durationMinutes).toBe(45);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("unsaved changes require confirmation and forms support Escape", async ({ page }) => {
  await mockOwner(page);
  await page.goto("/owner");
  await page.getByRole("button", { name: "Block time", exact: true }).click();
  await page.getByLabel("What is this time for?").fill("Unsaved break");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("the old admin starting page opens the simpler owner workspace", async ({ page }) => {
  await mockOwner(page, false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole("button", { name: "Open my shop", exact: true })).toBeVisible();
});

test("existing-customer booking is fast and an expired session never leaves private data onscreen", async ({ page }) => {
  const { state } = await mockOwner(page);
  await page.goto("/owner");
  await page.getByRole("button", { name: "Book a cut", exact: true }).click();
  await page.getByLabel("Find by name or phone").fill("Kai");
  await page.getByRole("button", { name: /Kai Morgan.*Choose/ }).click();
  await page.getByRole("button", { name: "9:30 AM", exact: true }).click();
  await page.getByRole("button", { name: "Book this cut" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const write = state.writes.find((w) => w.path === "appointments/save")!;
  expect(write.data.customerId).toBe(1);
  expect(write.data.newCustomer).toBeUndefined();
  await page.route("**/api/owner/appointments/save", (route) => route.fulfill({ status: 401, json: { error: "Session expired." } }));
  await page.locator(".studio-visit-main").first().click();
  await page.getByLabel("Visit notes", { exact: false }).fill("This must not save");
  await page.getByRole("button", { name: "Save visit changes" }).click();
  await expect(page.getByRole("button", { name: "Open my shop" })).toBeVisible();
  await expect(page.getByText("Please sign in again, then check your schedule before retrying.", { exact: true })).toBeVisible();
  await expect(page.getByText("Kai Morgan", { exact: true })).not.toBeVisible();
});
