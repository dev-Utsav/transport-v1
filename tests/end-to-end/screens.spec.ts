import { expect, test } from "@playwright/test";

/** Every main screen on the seeded sample data: loads, one h1, no console errors, no sideways scroll. */
const SCREENS = [
  "/",
  "/trips",
  "/trips/new",
  "/challans",
  "/challans/new",
  "/vendors",
  "/vendors/reminders",
  "/payments/new",
  "/expenses",
  "/expenses/new",
  "/salary",
  "/salary/register",
  "/salary/advances",
  "/gst",
  "/reports",
  "/reports/cash-book",
  "/reports/outstanding",
  "/reports/trip-profit",
  "/reports/expenses",
  "/reports/money",
  "/reports/parties",
  "/reports/performance",
  "/reports/performance?view=owners",
  "/reports/performance?view=trucks",
  "/settings",
  "/settings/trucks",
  "/settings/drivers",
  "/more",
  // Print pages (sample data always has challan 1, trip 1 and employee 1).
  "/challans/1/print",
  "/challans/1/print?as=invoice",
  "/trips/1/print",
  "/trips/1",
  "/challans/1",
  "/vendors/1",
  "/salary/1",
  "/salary/1/slip",
  "/settings/users",
  "/settings/users/new",
  "/settings/users/1",
  "/account/password",
];

for (const lang of ["en", "hi"] as const) {
  test.describe(`screens in ${lang}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "td_lang", value: lang, url: baseURL ?? "" }]);
    });

    for (const path of SCREENS) {
      test(path, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));

        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page.locator("h1")).toHaveCount(1);
        if (lang === "hi") await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
      });
    }
  });
}
