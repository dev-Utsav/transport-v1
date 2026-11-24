import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { E2E_PASSWORD } from "@/playwright.config";

/** Each role signs in fresh (not the admin session) and sees only its own doors. */
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, login: string) {
  await page.goto("/login");
  await page.getByLabel("Login name").fill(login);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Open the desk" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("a driver lands on their own trips and can't open the office screens", async ({ page }) => {
  await signIn(page, "ramesh");
  await expect(page).toHaveURL(/\/trips$/);
  // Sample data: Ramesh drives exactly one trip.
  await expect(page.locator('a[href^="/trips/"]')).toHaveCount(1);
  const own = await page.locator('a[href^="/trips/"]').first().getAttribute("href");
  for (const closed of ["/vendors", "/challans", "/salary", "/settings", "/reports"]) {
    const res = await page.goto(closed);
    expect(res?.status(), closed).toBe(404);
  }
  // Someone else's trip is "not found", their own opens.
  const others = ["/trips/1", "/trips/2", "/trips/3"].filter((p) => p !== own);
  expect((await page.goto(others[0] ?? "/trips/99"))?.status()).toBe(404);
  expect((await page.goto(own ?? "/"))?.status()).toBe(200);
  await expect(page.getByText("Profit")).toHaveCount(0);
});

test("a helper sees trips and parcels, no salary or settings", async ({ page }) => {
  await signIn(page, "kishan");
  await expect(page).toHaveURL(/\/$/);
  expect((await page.goto("/trips"))?.status()).toBe(200);
  expect((await page.goto("/salary"))?.status()).toBe(404);
  expect((await page.goto("/settings"))?.status()).toBe(404);
});

test("office can't open users or salary, but manages trucks", async ({ page }) => {
  await signIn(page, "neha");
  expect((await page.goto("/settings/users"))?.status()).toBe(404);
  expect((await page.goto("/salary"))?.status()).toBe(404);
  expect((await page.goto("/settings/trucks"))?.status()).toBe(200);
});
