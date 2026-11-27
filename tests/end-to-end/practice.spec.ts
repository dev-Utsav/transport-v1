import { expect, test } from "@playwright/test";

/**
 * Settings → "Take the tour" / "Practice desk" open the practice desk on fresh sample data and
 * come back to the real desk. Live answered 500 on this (2026-11-27); nothing covered it before.
 */
test("Take the tour opens the practice desk with the tour, and Back returns", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(page).toHaveURL(/\/(\?tour=start)?$/);
  await expect(page.getByText("Practice desk: sample data, nothing here is real.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End tour" })).toBeVisible();

  await page.getByRole("button", { name: "End tour" }).click();
  await page.getByRole("button", { name: "Back to my desk" }).click();
  await expect(page.getByText("Practice desk: sample data, nothing here is real.")).toHaveCount(0);
});

test("Practice desk opens twice in a row (fresh sample each time)", async ({ page }) => {
  for (let i = 0; i < 2; i += 1) {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Practice desk" }).click();
    await expect(page.getByText("Practice desk: sample data, nothing here is real.")).toBeVisible();
    await page.getByRole("button", { name: "Back to my desk" }).click();
    await expect(page.getByText("Practice desk: sample data, nothing here is real.")).toHaveCount(
      0,
    );
  }
});
