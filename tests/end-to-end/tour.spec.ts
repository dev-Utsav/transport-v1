import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * The guided tour, the way a new user meets it (Settings → Take the tour). The screen decides and
 * the tour follows: only the asked-for answer moves it on, a refused Next or Save never leaves it
 * pointing at nothing, and Back moves the screen too (tour/ screenshots, 2026-11-27).
 */
test.setTimeout(180_000);

const bubble = (page: Page) => page.locator("[data-tour-step]");
const expectStep = (page: Page, id: string) =>
  expect(bubble(page)).toHaveAttribute("data-tour-step", id, { timeout: 15_000 });
const tourButton = (page: Page, name: string) =>
  bubble(page).getByRole("button", { name, exact: true });
const hook = (page: Page, name: string) => page.locator(`[data-tour="${name}"]:visible`).first();
const formStep = (page: Page) => page.locator("form[data-steps]");

async function startTour(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expectStep(page, "welcome");
}

/** Welcome → New challan, parties picked, on "Tap Next" (panel 0). */
async function toNext1(page: Page) {
  await startTour(page);
  await tourButton(page, "Next").click();
  await expectStep(page, "book");
  await hook(page, "flow-book-cta").click();
  await expectStep(page, "sender");
  await page.locator("#senderId").selectOption({ index: 2 });
  await expectStep(page, "receiver");
  await page.locator("#receiverId").selectOption({ index: 3 });
  await expectStep(page, "next1");
}

/** …through goods and freight to "Save" (panel 3). */
async function toSave(page: Page) {
  await toNext1(page);
  await hook(page, "step-next").click();
  await expectStep(page, "to");
  await page.locator("#toPlace").fill("Delhi");
  await tourButton(page, "Next").click();
  await expectStep(page, "packages");
  await page.locator("#packages").fill("10");
  await tourButton(page, "Next").click();
  await expectStep(page, "next2");
  await hook(page, "step-next").click();
  await expectStep(page, "freight");
  await page.locator("#freight").fill("1500");
  await tourButton(page, "Next").click();
  await expectStep(page, "payType");
  await page.locator('label:has(input[name="payType"][value="to_pay"])').click();
  await expectStep(page, "next3");
  await hook(page, "step-next").click();
  await expectStep(page, "save");
}

test("a new user walks the whole tour start to finish, never skipping", async ({ page }) => {
  await toSave(page);
  await hook(page, "save").click();
  await expectStep(page, "nextCard");
  await expect(page).toHaveURL(/\/challans\/\d+(\?|$)/);
  await expect(tourButton(page, "Back")).toHaveCount(0); // the challan is saved: no undo
  await tourButton(page, "Next").click();
  await expectStep(page, "loadOn");
  await hook(page, "load-on-trip").click();
  await expectStep(page, "trip");
  await expect(page).toHaveURL(/\/trips\/\d+(\?|$)/);
  await tourButton(page, "Next").click();
  await expectStep(page, "tick");
  await hook(page, "load-panel").locator('input[type="checkbox"]').first().check();
  await expectStep(page, "loadSubmit");
  await hook(page, "load-submit").click();
  await expectStep(page, "dispatch");
  await expect(tourButton(page, "Back")).toHaveCount(0);
  await page.locator('[data-tour="next-action"][data-state="dispatch"]').click();
  await expectStep(page, "arrive");
  await page.locator('[data-tour="next-action"][data-state="arrive"]').click();
  await expectStep(page, "deliver");
  await hook(page, "deliver-first").click();
  await expectStep(page, "parties");
  await hook(page, "nav-vendors").click();
  await expectStep(page, "partyRow");
  await hook(page, "party-row").click();
  await expectStep(page, "ledger");
  for (const next of ["pay", "office", "lang", "done"]) {
    await tourButton(page, "Next").click();
    await expectStep(page, next);
  }
  await expect(page.getByText("Skip this step")).toHaveCount(0);
  await bubble(page).getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText("Practice desk: sample data, nothing here is real.")).toHaveCount(0);
});

test("only the answer the tour asks for moves it on (screenshot 1)", async ({ page }) => {
  await startTour(page);
  await tourButton(page, "Next").click();
  await hook(page, "flow-book-cta").click();
  await expectStep(page, "sender");
  // "+ New party" would open name and phone fields the tour never asks for.
  await page.locator("#senderId").selectOption("new");
  await expectStep(page, "sender");
  await expect(bubble(page).getByText("Not that one")).toBeVisible();
  await page.locator("#senderId").selectOption({ index: 2 });
  await expectStep(page, "receiver");
  await page.locator("#receiverId").selectOption({ index: 3 });
  await hook(page, "step-next").click();
  await expectStep(page, "to");
  await page.locator("#toPlace").fill("Mumbai");
  await expect(tourButton(page, "Next")).toHaveCount(0);
  await page.locator("#toPlace").fill("Delhi");
  await tourButton(page, "Next").click();
  await page.locator("#packages").fill("0"); // the server needs at least 1
  await expect(tourButton(page, "Next")).toHaveCount(0);
  await page.locator("#packages").fill("10");
  await tourButton(page, "Next").click();
  await hook(page, "step-next").click();
  await expectStep(page, "freight");
  await page.locator("#freight").fill("0"); // the server needs more than zero
  await expect(tourButton(page, "Next")).toHaveCount(0);
  await page.locator("#freight").fill("1,500");
  await tourButton(page, "Next").click();
  await expectStep(page, "payType");
  // Paid needs "Received by", which the tour doesn't cover: it doesn't count.
  await page.locator('label:has(input[name="payType"][value="paid"])').click();
  await expectStep(page, "payType");
  await expect(bubble(page).getByText("Not that one")).toBeVisible();
  await page.locator('label:has(input[name="payType"][value="to_pay"])').click();
  await expectStep(page, "next3");
});

test("a refused Next keeps the tour on that step and says what to fix", async ({ page }, info) => {
  await toNext1(page);
  await page.locator("#bookedOn").fill("");
  await hook(page, "step-next").click();
  await expect(bubble(page).getByText("First fill the field marked")).toBeVisible();
  await expectStep(page, "next1");
  await expect(formStep(page)).toHaveAttribute("data-step", "0");
  await page.screenshot({ path: info.outputPath("tour-refused-next.png") });
  // The refused field is lit and can be tapped (click fails if the dimmed screen covers it).
  await page.locator("#bookedOn").click();
  await page.locator("#bookedOn").fill("2026-11-27");
  await expect(bubble(page).getByText("First fill the field marked")).toHaveCount(0);
  await hook(page, "step-next").click();
  await expectStep(page, "to");
});

test("tour Back moves the screen too, and the tour carries on (back-click.png)", async ({
  page,
}) => {
  await toNext1(page);
  await expect(tourButton(page, "Back")).toBeVisible();
  await hook(page, "step-next").click();
  await page.locator("#toPlace").fill("Delhi");
  await tourButton(page, "Next").click();
  await expectStep(page, "packages");
  await tourButton(page, "Back").click();
  await expectStep(page, "to");
  await tourButton(page, "Back").click();
  await expectStep(page, "next1");
  // The form is back on Parties, with the parties still picked.
  await expect(formStep(page)).toHaveAttribute("data-step", "0");
  await expect(page.locator("#senderId")).toBeVisible();
  await expect(page.locator("#senderId")).not.toHaveValue("");
  await hook(page, "step-next").click();
  await expectStep(page, "to");
  await expect(page.locator("#toPlace")).toHaveValue("Delhi");
  // Already answered: Next is offered straight away.
  await tourButton(page, "Next").click();
  await expectStep(page, "packages");
  // The sender step can't go Back: "New challan" was on another screen.
  await page.locator("#packages").fill("10");
});

test("paused, the person uses the form freely; on Resume the tour follows the screen", async ({
  page,
}) => {
  await toSave(page);
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveCount(0);
  await page.locator("form[data-steps]").getByRole("button", { name: "Back" }).click();
  await expect(formStep(page)).toHaveAttribute("data-step", "2");
  await page.getByRole("button", { name: "Resume tour" }).click();
  await expectStep(page, "freight");
});

test("a refused save brings the tour to the field and keeps what was picked (3.png, 4.png)", async ({
  page,
}) => {
  await toSave(page);
  const sender = await page.locator("#senderId").inputValue();
  // Something the server refuses that the form can't know about in advance.
  await page.locator("#freight").evaluate((el) => {
    if (el instanceof HTMLInputElement) el.value = "0";
  });
  await hook(page, "save").click();
  await expect(page.getByText("Please check the marked fields.")).toBeVisible();
  await expectStep(page, "freight");
  await expect(formStep(page)).toHaveAttribute("data-step", "2");
  await expect(page.locator("#senderId")).toHaveValue(sender);
  await expect(page.locator('input[name="payType"][value="to_pay"]')).toBeChecked();
  await page.locator("#freight").fill("1500");
  await tourButton(page, "Next").click();
  await expectStep(page, "payType");
  await tourButton(page, "Next").click(); // already To-Pay
  await hook(page, "step-next").click();
  await expectStep(page, "save");
  await hook(page, "save").click();
  await expectStep(page, "nextCard");
});

test("in Hindi: the tour speaks Hindi, hints included, and nothing spills off screen", async ({
  page,
  context,
  baseURL,
}, info) => {
  await context.addCookies([
    { name: "td_lang", value: "hi", url: baseURL ?? "http://localhost:3300" },
  ]);
  await page.goto("/settings");
  await page.getByRole("button", { name: "टूर लें" }).click();
  await expectStep(page, "welcome");
  await tourButton(page, "आगे").click();
  await hook(page, "flow-book-cta").click();
  await expectStep(page, "sender");
  await page.locator("#senderId").selectOption("new");
  await expect(bubble(page).getByText("यह नहीं")).toBeVisible();
  // The bubble fits the screen with the longest hint showing.
  const box = await bubble(page).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
  await page.screenshot({ path: info.outputPath("tour-hi-wrong-choice.png") });
  await page.locator("#senderId").selectOption({ index: 2 });
  await page.locator("#receiverId").selectOption({ index: 3 });
  await page.locator("#bookedOn").fill("");
  await hook(page, "step-next").click();
  await expect(bubble(page).getByText("पहले स्क्रीन पर निशान वाला खाना भरें")).toBeVisible();
  await page.screenshot({ path: info.outputPath("tour-hi-fix-first.png") });
});
