import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { E2E_PASSWORD } from "@/playwright.config";

/**
 * A realistic office day: six signed-in devices working at the same moment (admin on phone and
 * desktop, Neha (office) on two devices, the driver and the helper). Four of them book challans
 * at once; every save must land with its own challan number, nothing may fail, and the driver
 * and helper keep their limits while the desk is busy.
 * Also runs against staging: E2E_BASE_URL=https://… pnpm exec playwright test multi-user
 */

test.use({ storageState: { cookies: [], origins: [] } });

async function device(browser: Browser, login: string, js = false): Promise<Page> {
  const context = await browser.newContext({ javaScriptEnabled: js });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Login name").fill(login);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Open the desk" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

/** Books one To-Pay challan (JS off, so the plain form post is what's measured). */
async function book(page: Page, freight: string): Promise<string> {
  await page.goto("/challans/new");
  await page.locator("select[name=senderId]").selectOption({ index: 2 });
  await page.locator("select[name=receiverId]").selectOption({ index: 3 });
  await page.locator("input[name=fromPlace]").fill("Kadodara");
  await page.locator("input[name=toPlace]").fill("Surat");
  await page.locator("input[name=packages]").fill("2");
  await page.locator("input[name=freight]").fill(freight);
  await page.locator("input[name=payType][value=to_pay]").check({ force: true });
  await page.locator("input[name=gstMode][value=none]").check({ force: true });
  await page.locator("form button[type=submit]").last().click();
  await expect(page).toHaveURL(/\/challans\/\d+\?saved=1$/, { timeout: 20_000 });
  return new URL(page.url()).pathname;
}

test("six devices at once: every booking saves with its own number", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough; it opens its own devices");
  test.setTimeout(120_000);

  const [adminPhone, adminDesk, nehaA, nehaB, driver, helper] = await Promise.all([
    device(browser, "admin"),
    device(browser, "admin"),
    device(browser, "neha"),
    device(browser, "neha"),
    device(browser, "ramesh"),
    device(browser, "kishan"),
  ]);

  const bookers = [adminPhone, adminDesk, nehaA, nehaB];
  const [booked] = await Promise.all([
    // two rounds of four simultaneous bookings
    Promise.all(bookers.map((p, i) => book(p, `${1000 + i}`))).then(async (first) => [
      ...first,
      ...(await Promise.all(bookers.map((p, i) => book(p, `${2000 + i}`)))),
    ]),
    // meanwhile the driver and helper work their own screens and keep their limits
    (async () => {
      for (let round = 0; round < 3; round++) {
        expect((await driver.goto("/trips"))?.status()).toBe(200);
        expect((await driver.goto("/vendors"))?.status()).toBe(404);
        expect((await helper.goto("/trips"))?.status()).toBe(200);
        expect((await helper.goto("/salary"))?.status()).toBe(404);
      }
    })(),
  ]);

  expect(new Set(booked).size).toBe(8);

  // each saved challan shows a distinct challan number
  // one page, so one visit at a time
  const numbers: (string | null)[] = [];
  for (const path of booked) {
    await adminDesk.goto(path);
    numbers.push(
      await adminDesk.locator("[data-challan-no]").first().getAttribute("data-challan-no"),
    );
  }
  expect(numbers.every(Boolean)).toBe(true);
  expect(new Set(numbers).size).toBe(8);
});
