import { expect, test as setup } from "@playwright/test";

import { E2E_PASSWORD } from "@/playwright.config";

setup("signs in (wrong password first) and saves the session", async ({ page }) => {
  await page.goto("/trips");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrips/);

  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Open the desk" }).click();
  await expect(page.getByText("Wrong password.")).toBeVisible();

  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Open the desk" }).click();
  // Back where the user was headed, not the home page.
  await expect(page).toHaveURL(/\/trips$/);
  await page.context().storageState({ path: ".data/e2e-results/session.json" });
});
