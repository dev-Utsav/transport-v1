import { readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "@/lib/access";
import { E2E_PASSWORD } from "@/playwright.config";

/**
 * Every screen and API route, opened by every demo login. A URL must open exactly when the role's
 * default grants (lib/access.ts) include one of the permissions its page asks for; otherwise a
 * page answers 404 (a hidden screen isn't revealed) and an API route 403. Signed out, everything
 * goes to the login page (API: 401). roles.spec.ts covers a driver's own-trip scope.
 */
test.use({ storageState: { cookies: [], origins: [] } });

type Route = { pattern: RegExp; anyOf: readonly Permission[] };

/** Mirrors each page's `requireAccess(...)` / route's `apiDenied(...)`. [] = any signed-in person. */
const PAGES: Route[] = [
  { pattern: /^\/$/, anyOf: [] },
  { pattern: /^\/more$/, anyOf: [] },
  { pattern: /^\/account\/password$/, anyOf: [] },
  { pattern: /^\/new$/, anyOf: ["challans.book"] },
  { pattern: /^\/challans$/, anyOf: ["challans.view"] },
  { pattern: /^\/challans\/new$/, anyOf: ["challans.book"] },
  { pattern: /^\/challans\/\d+$/, anyOf: ["challans.view"] },
  { pattern: /^\/challans\/\d+\/print$/, anyOf: ["challans.view"] },
  { pattern: /^\/challans\/\d+\/edit$/, anyOf: ["challans.edit"] },
  { pattern: /^\/trips$/, anyOf: ["trips.view"] },
  { pattern: /^\/trips\/new$/, anyOf: ["trips.manage"] },
  { pattern: /^\/trips\/\d+$/, anyOf: ["trips.view"] },
  { pattern: /^\/trips\/\d+\/print$/, anyOf: ["trips.view"] },
  { pattern: /^\/trips\/\d+\/edit$/, anyOf: ["trips.manage"] },
  { pattern: /^\/vendors$/, anyOf: ["parties.view"] },
  { pattern: /^\/vendors\/reminders$/, anyOf: ["parties.view"] },
  { pattern: /^\/vendors\/new$/, anyOf: ["parties.manage"] },
  { pattern: /^\/vendors\/\d+$/, anyOf: ["parties.view"] },
  { pattern: /^\/vendors\/\d+\/edit$/, anyOf: ["parties.manage"] },
  { pattern: /^\/payments\/new$/, anyOf: ["payments.record"] },
  { pattern: /^\/expenses$/, anyOf: ["expenses.view"] },
  { pattern: /^\/expenses\/new$/, anyOf: ["expenses.record"] },
  { pattern: /^\/expenses\/\d+$/, anyOf: ["expenses.view"] },
  { pattern: /^\/gst$/, anyOf: ["gst.view"] },
  { pattern: /^\/reports$/, anyOf: ["reports.view"] },
  { pattern: /^\/reports\/parties$/, anyOf: ["reports.view", "parties.view"] },
  {
    pattern: /^\/reports\/(cash-book|expenses|money|outstanding|performance|trip-profit)$/,
    anyOf: ["reports.view"],
  },
  { pattern: /^\/salary$/, anyOf: ["salary.view"] },
  { pattern: /^\/salary\/register$/, anyOf: ["salary.view"] },
  { pattern: /^\/salary\/advances$/, anyOf: ["advances.record"] },
  { pattern: /^\/salary\/staff\/new$/, anyOf: ["salary.manage"] },
  { pattern: /^\/salary\/staff\/\d+$/, anyOf: ["salary.manage"] },
  { pattern: /^\/salary\/\d+$/, anyOf: ["salary.view"] },
  { pattern: /^\/salary\/\d+\/slip$/, anyOf: ["salary.view"] },
  {
    pattern: /^\/settings$/,
    anyOf: ["settings.manage", "masters.manage", "users.manage", "backup.download"],
  },
  { pattern: /^\/settings\/(trucks|drivers)$/, anyOf: ["masters.manage"] },
  { pattern: /^\/settings\/users$/, anyOf: ["users.manage"] },
  { pattern: /^\/settings\/users\/new$/, anyOf: ["users.manage"] },
  { pattern: /^\/settings\/users\/\d+$/, anyOf: ["users.manage"] },
];

const SALARY_EXPORT: readonly Permission[] = ["reports.export", "salary.view"];
const APIS: { url: string; anyOf: readonly Permission[]; all?: boolean }[] = [
  { url: "/api/backup", anyOf: ["backup.download"] },
  { url: "/api/backup/1", anyOf: ["backup.download"] },
  { url: "/api/bill/1", anyOf: ["expenses.view"] },
  ...["gst", "expenses", "trip-profit", "outstanding", "cash-book", "ledger"].map((r) => ({
    url: `/api/export/${r}`,
    anyOf: ["reports.export"] as const,
  })),
  // Needs both: reports.export, then salary.view.
  { url: "/api/export/salary", anyOf: SALARY_EXPORT, all: true },
];

/** URLs with a sample id in them: found as admin from the list screens, so ids always exist. */
const LISTS = ["/challans", "/trips", "/vendors", "/expenses", "/salary", "/settings/users"];
const DETAIL = /href="(\/(?:challans|trips|vendors|expenses|salary|settings\/users)\/\d+[^"]*)"/g;

const ROLES = ["office", "driver", "helper"] as const;
const LOGIN = { admin: "admin", office: "neha", driver: "ramesh", helper: "kishan" } as const;

function routeOf(url: string): Route | undefined {
  const pathname = url.split("?")[0] ?? url;
  return PAGES.find((r) => r.pattern.test(pathname));
}

function allowed(role: keyof typeof LOGIN, anyOf: readonly Permission[], all = false): boolean {
  const grants: readonly Permission[] =
    role === "admin" ? DEFAULT_ROLE_PERMISSIONS.admin : DEFAULT_ROLE_PERMISSIONS[role];
  if (anyOf.length === 0) return true;
  return all ? anyOf.every((p) => grants.includes(p)) : anyOf.some((p) => grants.includes(p));
}

async function signIn(page: Page, login: string): Promise<APIRequestContext> {
  await page.goto("/login");
  await page.getByLabel("Login name").fill(login);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Open the desk" }).click();
  // A cold server can take a while to sign in (see PROGRESS.md, slow first clicks).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  return page.request;
}

async function status(req: APIRequestContext, url: string): Promise<number> {
  try {
    return (await req.get(url, { maxRedirects: 0 })).status();
  } catch {
    // One retry on a dropped connection (seen against the deployed desk), not on a wrong status.
    return (await req.get(url, { maxRedirects: 0 })).status();
  }
}

/** Every page.tsx under app/(desk) as a sample path, so a new screen can't skip this table. */
function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return pageFiles(full);
    return e.name === "page.tsx" ? [full] : [];
  });
}

test("every screen is in the access table", () => {
  const root = path.join("app", "(desk)");
  const missing = pageFiles(root)
    .map((f) => {
      const rel = path.relative(root, path.dirname(f)).split(path.sep).join("/");
      return `/${rel}`.replace(/\[id\]/g, "1").replace(/\/$/, "") || "/";
    })
    .filter((p) => !routeOf(p));
  expect(missing).toEqual([]);
});

test("each role opens exactly what its grants allow", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const admin = await signIn(page, LOGIN.admin);

  // Collect concrete URLs: static ones from the table, detail ones from the admin's lists.
  const urls = new Set<string>([
    "/",
    "/more",
    "/account/password",
    "/new",
    "/challans",
    "/challans/new",
    "/trips",
    "/trips/new",
    "/vendors",
    "/vendors/reminders",
    "/vendors/new",
    "/payments/new",
    "/expenses",
    "/expenses/new",
    "/gst",
    "/reports",
    "/reports/parties",
    "/reports/cash-book",
    "/reports/expenses",
    "/reports/money",
    "/reports/outstanding",
    "/reports/performance",
    "/reports/trip-profit",
    "/salary",
    "/salary/register",
    "/salary/advances",
    "/salary/staff/new",
    "/settings",
    "/settings/trucks",
    "/settings/drivers",
    "/settings/users",
    "/settings/users/new",
  ]);
  for (const list of LISTS) {
    const html = await (await admin.get(list)).text();
    for (const [, href] of html.matchAll(DETAIL)) if (href) urls.add(href.replaceAll("&amp;", "&"));
  }
  for (const u of [...urls]) {
    if (/^\/salary\/\d+/.test(u)) {
      // A person's salary page links to their slip and their staff record.
      const html = await (await admin.get(u)).text();
      for (const [, href] of html.matchAll(/href="(\/salary\/(?:\d+\/slip|staff\/\d+)[^"]*)"/g)) {
        if (href) urls.add(href.replaceAll("&amp;", "&"));
      }
    }
    if (/^\/(challans|trips|vendors)\/\d+$/.test(u)) {
      urls.add(`${u}/${u.startsWith("/vendors") ? "edit" : "print"}`);
      if (u.startsWith("/challans") || u.startsWith("/trips")) urls.add(`${u}/edit`);
    }
  }

  // Admin must open every one of them (else the table or the sample data is off).
  const adminOpen: string[] = [];
  for (const u of urls) if ((await status(admin, u)) === 200) adminOpen.push(u);
  const adminShut = [...urls].filter((u) => !adminOpen.includes(u));
  // A challan that is already on a trip, cancelled or paid can refuse edit: that's not access.
  expect(adminShut.filter((u) => !/\/edit$/.test(u))).toEqual([]);
  for (const u of adminOpen) expect(routeOf(u), `no access rule for ${u}`).toBeTruthy();

  for (const role of ROLES) {
    const context = await browser.newContext();
    const req = await signIn(await context.newPage(), LOGIN[role]);
    const wrong: string[] = [];
    for (const url of adminOpen) {
      // Driver trip pages depend on whose trip it is: roles.spec.ts checks that.
      if (role === "driver" && /^\/trips\/\d+/.test(url)) continue;
      const route = routeOf(url);
      if (!route) continue;
      // Home is the office's work board; whoever can't see parcels is sent on to their trips.
      const sentOn = url === "/" && !allowed(role, ["challans.view"]);
      const want = sentOn ? 307 : allowed(role, route.anyOf) ? 200 : 404;
      const got = await status(req, url);
      if (got !== want) wrong.push(`${url}: got ${got}, want ${want}`);
    }
    for (const api of APIS) {
      const got = await status(req, api.url);
      const ok = allowed(role, api.anyOf, api.all);
      if (ok ? got === 401 || got === 403 : got !== 403) {
        wrong.push(`${api.url}: got ${got}, want ${ok ? "not 401/403" : 403}`);
      }
    }
    expect(wrong, `${role} (${LOGIN[role]})`).toEqual([]);
    await context.close();
  }
});

test("no role is shown a link it can't open", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const role of ["admin", ...ROLES] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const req = await signIn(page, LOGIN[role]);
    const shown = new Set<string>();
    for (const screen of ["/", "/more", "/trips"]) {
      const res = await page.goto(screen);
      if (res?.status() !== 200) continue;
      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      for (const h of hrefs) if (h && !h.startsWith("/api/")) shown.add(h);
    }
    const dead: string[] = [];
    for (const h of shown) {
      const s = await status(req, h);
      if (s === 404 || s === 403) dead.push(`${h}: ${s}`);
    }
    expect(dead, `${role} (${LOGIN[role]})`).toEqual([]);
    await context.close();
  }
});

test("signed out, every screen goes to the login page and every API answers 401", async ({
  request,
}) => {
  for (const url of ["/", "/salary", "/settings/users", "/gst", "/challans/1", "/reports/money"]) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(307);
    expect(res.headers()["location"], url).toContain("/login");
  }
  for (const api of APIS) expect((await request.get(api.url)).status(), api.url).toBe(401);
});
