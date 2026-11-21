import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Forms must work without JavaScript (slow phones, a script that failed to load). */
test.use({ javaScriptEnabled: false });

async function fillChallan(page: Page, freight: string) {
  await page.goto("/challans/new");
  await page.locator("select[name=senderId]").selectOption({ index: 2 });
  await page.locator("select[name=receiverId]").selectOption({ index: 3 });
  await page.locator("input[name=fromPlace]").fill("Kadodara");
  await page.locator("input[name=toPlace]").fill("Jaipur");
  await page.locator("input[name=packages]").fill("4");
  await page.locator("input[name=freight]").fill(freight);
  await page.locator("input[name=payType][value=to_pay]").check({ force: true });
  await page.locator("input[name=gstMode][value=none]").check({ force: true });
}

test("books a To-Pay challan with JavaScript off", async ({ page }) => {
  await fillChallan(page, "2,400");
  await page.locator("form button[type=submit]").last().click();
  await expect(page).toHaveURL(/\/challans\/\d+\?saved=1$/);
  await expect(page.getByText("Jaipur").first()).toBeVisible();
});

test("a refused save keeps what was typed (JavaScript off)", async ({ page }) => {
  await fillChallan(page, "abc");
  await page.locator("form button[type=submit]").last().click();
  await expect(page.locator("input[name=freight]")).toHaveValue("abc");
  await expect(page.locator("input[name=toPlace]")).toHaveValue("Jaipur");
  await expect(page.locator("input[name=freight]")).toHaveAttribute("aria-invalid", "true");
});
