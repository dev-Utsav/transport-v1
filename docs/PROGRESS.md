# Transport Desk: progress log

Newest entry at the top. Rules: `../CLAUDE.md`. Client brief: `Transport Management System Feature Document.docx` (this folder).

## 2026-11-21 (evening): one staff table, logins per person with roles, migrations squashed

Asked by the backend consultant (after the client asked for admin access): roles **admin / office / driver / helper**, **a driver sees only their own trips**, drivers and employees merged, no new migrations.

### Database

- **`staff` replaces `drivers` + `employees`.**
  - One record per person, so a salaried driver is no longer entered twice.
  - `on_payroll` with a CHECK constraint (on payroll needs a salary and a joining date); a hired truck's driver is staff off payroll.
  - `trips.driver_id`, `salary_months.staff_id` and `users.staff_id` all point at it.
  - Settings → Drivers adds drivers off payroll. Salary → Add staff lists them under "Put a driver on salary", which opens the same record (no duplicate).
- **Migrations squashed** into one `drizzle/0000_init.sql` (nothing deployed yet). From the first `pnpm db:migrate` on Supabase onwards, only add migrations (written into CLAUDE.md §6).
- Local dev data was recreated: the old copy is in `.data/_old-before-squash/`, which can be deleted.

### Logins and roles (wired end to end)

- **A login per person:** login name + password (scrypt).
  - The cookie is signed with the new **`SESSION_SECRET`** and carries the user id + `session_version`.
  - `proxy.ts` checks only the signature. Every page (`requireAccess`), action (`assertCan`) and API route (`apiDenied`) loads the user, their active roles and permissions in one query.
  - A unit test fails if any page, route or action skips its check.
- **First run:** while no login exists, the sign-in page shows "Set up the first admin" and asks for `APP_PASSWORD` as a one-time setup key.
- **Settings → Users** (admin): add or edit a user (roles as checkboxes, link to a staff member), reset a password (forces a change, signs them out), switch a login off.
  - Guards: always at least one active admin; nobody switches off themselves; a driver login must link to a driver in Staff.
- **Change my password** (More / Settings). A first password must be changed before anything else.
- **What each role can do** (`lib/access.ts`; open point 8 with the client):
  - admin: everything;
  - office: desk work, but no cancels, salaries, settings, backups, history or logins;
  - driver: **only their own trips** (no `trips.all`; trips list, trip, loading memo and the trip actions are all scoped by `staff_id`), can mark left / arrived, deliver and collect;
  - helper: every trip, load and unload.
- **Screens follow permissions:** menus and tabs, Home's office links, Settings sections, and trip buttons (load, deliver, correct status, edit, trip money). A driver starts on Trips.
- **The audit log records who** (`audit_log.actor_id`, from the signed cookie, so no extra query inside the transaction).
- **Login rate limit:** 5 tries a minute per login name per IP, 30 per IP.
- **Local demo** (`SEED_DEMO=1`): logins admin, neha (office), ramesh (driver), kishan (helper), with the `APP_PASSWORD` from `.env.local`.

### Found and fixed on the way

- `logChange` looked up the user inside the write transaction. On the embedded database (one connection) every write hung. It now reads the id from the verified cookie.
- Existing roles keep their permissions when the code defaults change, by design (admin edits win). The dev database had the earlier driver default; it was recreated. **For live data, a changed default needs an explicit update** (or a roles editor; see Next).

### Verified

- `pnpm check`: 92 unit + integrated tests (staff rules, driver scoping, helper / office limits, setup key, sign-in, last-admin guard, password reset, audit actor), lint 0, build OK.
- `pnpm test:e2e`: 147 passed. Every screen including the Users pages in English / Hindi at 390 / 1440, plus a spec per role (the driver sees 1 trip and gets 404 elsewhere; helper and office limits).
- Signed in as each demo login on the dev server; the Users form checked at 390 px in Hindi.

### Before deploying (new)

- Add **`SESSION_SECRET`** (32+ random characters) to Vercel and to `.env.production` / `.env.production.local`. Production refuses to start without it.
- `APP_PASSWORD` becomes the setup key: give it to the owner once, to create their admin login.

### Next

1. Client: confirm what each role may do (open point 8) and whether drivers may close a trip (currently yes, under "advance").
2. A roles editor (which permissions each role has) if the client wants to change them themselves. Today that is code plus a data update.
3. Commit (not done; waiting for the OK), then deploy.

## 2026-11-21 (later): local testing setup (unit, integrated, end-to-end)

The backend consultant asked for tests with a separate test database and seed data, local only (no CI). Everything was committed first (`fc4bd2e`).

### Set up

- **Unit** (`tests/unit/`, Vitest project `unit`): the 11 existing `lib/` test files, moved from `lib/`.
- **Integrated** (`tests/integrated/`, project `integrated`):
  - server actions and queries run against **in-memory PGlite**: migrated once per file, then a fresh copy per test;
  - Next's `cookies` / `headers` / `redirect` / `revalidatePath` / `server-only` are mocked (`tests/fixtures/next-mocks.ts`);
  - reads `tests/.env.test`.
- **End-to-end** (`tests/end-to-end/`, Playwright 1.65.0, the only new dependency):
  - runs a production build on :3300 against `.data/e2e` (wiped and seeded every run), in the installed Chrome at phone 390 and desktop 1440;
  - covers login, every screen in English and Hindi (200 status, one h1, no console errors, no sideways scroll), and challan booking and a refused save with JS off.
- **Seams in app code:**
  - `setDatabasesForTest()` in `server/db/index.ts` (refused unless `NODE_ENV=test`);
  - `TD_DATA_DIR` for the PGlite folder.
- **Scripts:** `test`, `test:unit`, `test:int`, `test:e2e`, `test:all`.

### Bugs the tests caught (fixed, each with its test)

1. **Cancelling a challan re-cancelled payments that were already cancelled**, writing duplicate cancel entries into the change history (`server/actions/challans.ts`).
2. **CSV formula injection:** a party named `=HYPERLINK(...)` became a live formula in Excel. Text cells starting with `= + - @` now get a `'` prefix, and plain numbers such as `-1500.00` are left alone so Excel still sums them (`lib/csv.ts`).
3. **Two `<h1>` headings** on the salary register, salary slip, challan print and loading memo: the letterhead name is now a paragraph.
4. **On phones, the salary register and slip scrolled sideways**: the letterhead badge couldn't wrap. The header wraps now.

### Verified

- `pnpm check` passes: 61 unit + integrated tests, about 4 s.
- `pnpm test:e2e`: 125 passed.

### Not covered yet (next tests to write)

- Trips (load / unload after departure, status backwards), expenses with a photo (size, fake type), salary edge months, reports totals versus the ledger, the practice desk never writing to real data, login rate limiting.
- The guided tour as an E2E spec.
- Concurrency (two bookings at once) needs real Postgres; PGlite has one connection.

## 2026-11-21: users, roles and permissions (database layer)

After the demo the client asked for admin access, which means separate logins. The backend consultant asked for the database to have users, roles, permissions, role permissions and user roles.

### Done

- **Migration `drizzle/0002_access_rbac.sql`** (additive only, nothing existing changes shape):
  - new tables `users`, `roles`, `permissions`, `role_permissions` and `user_roles`;
  - `audit_log.actor_id` records who made each change.
- **`lib/access.ts`** holds the permission catalog (26 keys, `as const`), the 4 system roles (admin, office, driver, helper) and their default matrix. System roles the code drops are switched off on start.
- **`server/db/access.ts`** `ensureAccessCatalog()` runs on start (real and practice desks):
  - syncs permission keys (keys the code drops are retired, not deleted);
  - creates any missing system roles with their defaults;
  - tops Admin up to every permission.
- **`lib/password.ts`**: scrypt hashes from node:crypto, no new dependency. Parameters are stored with each hash.
- **Backup** now includes the access tables. Users are included **without password hashes**.
- **Checks:** `pnpm check` passes with 40 tests; all 3 migrations apply to a fresh PGlite.

### Not done yet (the app still logs in with the one shared `APP_PASSWORD`)

1. Login by user (login + password), with a session token carrying `userId` and `sessionVersion`, checked against the DB on each action.
2. Replace `assertAdmin()` with `assertCan(permission)` in every action and API route, and hide nav items and buttons the user can't use.
3. `logChange()` writes `actorId`.
4. Settings → Users and roles screen (Office work), plus "change password on first sign-in".
5. Bootstrap: when `users` is empty, the first sign-in with `APP_PASSWORD` creates the Admin, then `APP_PASSWORD` stops working.
6. Practice desk: a sample owner, plus the tour steps re-checked.
7. Supabase: enable RLS (no policies) on all public tables, so the Data API can't read them. The app connects as the DB owner, so it is unaffected.

### Open points with the client

8. **Roles decided (Utsav, 2026-11-21): admin, office, driver, helper** (`lib/access.ts`). Still open with the client: what each may do. Defaults: admin = everything; office = desk work, but no cancelling money records, salaries, settings, backups, history or logins; driver = see trips and parcels, left / arrived, deliver and collect; helper = see trips and parcels, load and unload. Trip permissions are split into `trips.manage` / `trips.load` / `trips.advance` / `trips.deliver` for this. Also open: should a driver see only their own trips? That would use `users.employee_id` → `trips.driver_id`.
9. Drivers get a login and see only their own trips (decided 2026-11-21).

## 2026-11-20 (later): one flow everywhere, practice desk, guided tour

Utsav: the flow felt confusing. He wanted one flow that every step and screen follows, anything else they need, and an interactive tour that waits for the user to act before moving on.

### Why it felt confusing (before)

- Trips and challans were separate islands: putting parcels on a truck meant editing each challan.
- Delivery and collection were buried in status buttons.
- Home showed four equal shortcuts with no order.
- Nothing told the admin what comes next.

### Changed

- **One five-step flow** (`lib/flow.ts`, tested): Book → Load → On the road → Deliver → Collect.
  - Home is now a **work board** (`FlowBoard`): each step shows what is waiting and one button. "Office work" (expenses, payment, salary, reports) sits below it.
  - **`FlowBar`** ("you are here") is on New challan, challan, trip, new trip, record payment and reminders.
  - **Challan "Next step" card** (`NextStep`) shows one action for each state:
    - load it on a truck that is loading (one tap), or start a new trip with it;
    - open the trip;
    - mark delivered;
    - collect (Cash / UPI / Bank);
    - done.
  - **Trip screen by stage:**
    - the road card has one big next-action button (`advanceTrip`): Truck has left → Arrived → Close;
    - while loading, a **loading checklist** of waiting parcels, those for the same destination first (`LoadPanel`, `loadOnTrip`), and "Take off truck";
    - once arrived, a **delivery checklist** where each parcel is delivered, with To-Pay money taken in the same tap (`deliverChallan`);
    - the old status row sits under "Correct the status".
  - **Trips list** is grouped in flow order: Loading, On the road, Arrived (deliver), Closed.
  - **Start a trip from a parcel:** `/trips/new?challan=` loads it on save.
- **Added because a transport office needs it:**
  - a **loading memo** to print for the driver (`/trips/[id]/print`), with To-Pay money to collect;
  - a **WhatsApp payment receipt** after recording a payment;
  - **Truck hire** as an expense category;
  - a **Getting started** checklist on an empty real desk;
  - **Add to Home screen** (`app/manifest.ts`).
- **Practice desk** (separate database with sample data, banner, Start over, Back to my desk). Open it from More or Settings ("Take the tour" / "Practice desk") or from Getting started.
- **Guided tour**, 27 steps (`lib/tour.ts`, `components/tour/*`):
  - Spotlight and talk bubble; each step waits for the real action (tap, pick, type).
  - Survives page changes and server redirects, and offers "Take me there" if the person wanders off.
  - Escape pauses it, and "End tour" is always visible.
  - Hindi + English.

### Verified

- `pnpm check` passes: 37 tests and the build.
- The **full tour was run in Chrome at 390 and 1440 px**: a real challan was booked, loaded, dispatched, arrived and delivered with money on the practice desk; then party, ledger, office, language, and Finish back to the real desk. No console errors.
- Hindi tour and screens: no horizontal overflow.
- Regression flows still pass, including **booking a challan with JS off**.
- **Fixed during checks:** a delivery row overflowed on phones (grid column min-width), now guarded globally with `fieldset { min-width: 0 }` and `minmax(0,1fr)` rows.

### Not verified

- The practice `search_path` on Supabase's pooler. The code refuses (rather than touching real data) if it isn't honoured; if so, use the direct connection for practice.
- Lighthouse, still blocked by auto mode.
- A real phone.
- Native-speaker check of the new Hindi tour text.

### Next

1. Utsav walks the tour: More → Take the tour.
2. Send the client the open points below, plus a screen recording of the tour.
3. Deploy: Utsav will do it later (said 2026-11-20). Steps are in README → Deploy; afterwards, test the practice desk on Supabase and run Lighthouse.

## 2026-11-20: Phase 1 built (local)

**State:** every Phase 1 screen in the feature document is built and runs locally on the embedded database. Branch `build/phase-1`, **nothing committed yet**, not deployed.

### What's built (feature doc section → where)

| Doc        | Feature                                                                                                               | Screen / code                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 4.1        | Truck + driver masters                                                                                                | Settings → Trucks / Drivers (`app/(desk)/settings/trucks`, `/drivers`)                                                        |
| 4.1        | Trips with status Loading → In transit → Arrived → Closed                                                             | `/trips`, `/trips/new`, `/trips/[id]` (status stepper; In transit moves its challans to In transit)                           |
| 4.1, 4.3.1 | "What is on this truck?"                                                                                              | `/trips/[id]`: parties, packages, freight, still to collect, challans grouped by the party who pays, trip expenses and profit |
| 4.2        | Vendor (party) master + profile totals                                                                                | `/vendors`, `/vendors/[id]` (total business, received, pending, old balance)                                                  |
| 4.3        | Challan: auto number, trip + parties, goods, freight, Paid / To-Pay / Billed later, status                            | `/challans/new` (4 steps), `/challans/[id]`, `/challans/[id]/edit` (goods/trip only)                                          |
| 4.3        | A4 print + WhatsApp share, search by number / party / truck / date                                                    | `/challans/[id]/print`, `/challans?q=&day=`                                                                                   |
| 4.4        | Payments (Cash / UPI / Bank), Pending / Part paid / Udhaar, ledger with running balance, overdue reminders + WhatsApp | `/payments/new`, `/vendors/[id]`, `/vendors/reminders`                                                                        |
| 4.5        | Expenses with categories, mode, truck / trip link, bill photo; trip / truck / month reports                           | `/expenses`, `/expenses/new`, `/expenses/[id]`, `/reports/expenses`, `/reports/trip-profit`                                   |
| 4.6        | Staff, monthly attendance, advances, deductions, net salary, mark paid, slip, register                                | `/salary`, `/salary/[id]`, `/salary/[id]/slip`, `/salary/register`, `/salary/staff/*`                                         |
| 4.7        | GST settings, included / extra per challan, tax invoice, monthly summary to Excel                                     | Settings, `/challans/[id]/print?as=invoice`, `/gst`                                                                           |
| 4.8        | Dashboard                                                                                                             | `/` (to collect, today's collection by mode, today's spend, trucks on the road, shortcuts, reminders)                         |
| 4.9        | Cash book, outstanding, trip profit, expense report, salary register; PDF + Excel; daily backup                       | `/reports/*`, CSV via `/api/export/[report]`, PDF via print, nightly `/api/cron/backup` (keeps 30) + download in Settings     |
| 2, 3       | Phone first, Hindi / English switch on every screen, nothing deleted by accident, edits logged                        | AppShell + LangSwitch, cancel instead of delete, `audit_log` + "Change history" on records                                    |

### Design references (research 2026-11-20)

- **Ledger and reminders:** Khatabook / Vyapar pattern. Running balance per party, "+ charged / − received" signed amounts on phones, a one-tap WhatsApp reminder with the text ready.
- **Trip detail:** logistics-dashboard pattern (Dribbble / Contra fleet and shipment dashboards). A status stepper, then the load grouped by customer, with the money still out shown up front.
- **Forms:** the step-by-step editor Utsav approved for the internal tools (one job per screen), big tap choices instead of dropdowns, native pickers on phones.
- **Lists:** ruled rows, not card grids (Utsav's earlier feedback on the internal tools).
- **Own:** the "route rail" (truck on a dashed road between two places) as the tool's signature; the dark "road" ground only for the day's summary and trip status. Fonts IBM Plex Sans + Plex Sans Devanagari + Plex Mono (truck plates, challan numbers).

### Decisions taken (sensible defaults, change if the client wants)

- **Who owes a challan:** sender for Paid and Billed later, receiver for To-Pay. Paid challans record their payment (with mode) at booking, so the cash book and ledger agree.
- **Challan amounts can't be edited** after booking (goods, places and trip can). Cancel and rebook, so the ledger never changes silently.
- **Salary formula:** monthly × (present + half days ÷ 2) ÷ days in month, rounded to whole rupees, minus advance and deductions. Present defaults to the full month. Salary frozen per month.
- **Overdue reminder:** balance older than 15 days (Settings), oldest unpaid charge found first-in-first-out.
- **Challan number format:** prefix (Settings, e.g. `KDR/`) + 4-digit serial. The next number is set in Settings and can only go forward.
- **Excel = CSV** (UTF-8 BOM, opens in Excel with Hindi intact). **PDF = print → Save as PDF.** No extra libraries.
- **Backups:** nightly gzip JSON in the database (last 30) + download any time. Restore is manual for now.

### Open points with the client (from the doc, section 8, plus new ones)

1. Their paper challan format and numbering, so `/challans/[id]/print` can match it (the current layout is a common bilty layout). One copy or three (consignor / consignee / office)?
2. Challan per parcel or per consignment: the tool handles both (one challan = any number of packages).
3. Salary: fixed monthly (built) or a per-trip driver allowance too?
4. GST treatment from their CA (rate, reverse charge, exemptions). It's configurable today (default rate, included / extra / none per challan), nothing hard-coded. CGST/SGST/IGST split not shown yet.
5. Opening balances from the paper khata: supported per party ("old balance") and opening cash (Settings). Old challans are not imported.
6. **New:** the business name, address, phone and GSTIN for the letterhead (Settings).
7. **New:** party advance or credit (negative old balance) isn't supported in the form yet.

### Verified (2026-11-20)

- `pnpm check` passes: typecheck, lint with 0 warnings, 27 unit tests (money, GST, salary, ledger, FIFO overdue, dates, CSV, WhatsApp numbers, amount in words, session, image sniffing), production build.
- In Chrome (playwright-core + system Chrome) with demo data, at 390 px and 1440 px, every screen returns 200 with no console errors.
- These flows work end to end:
  - a challan through all 4 steps (empty step blocked, new receiver typed in place, trip fills To, Paid in cash, GST 5% extra = ₹2,625);
  - a payment against a challan;
  - an expense with a photo (shrunk to JPEG in the browser, shown on the expense page);
  - a refused save keeping what was typed;
  - salary marked paid;
  - the Hindi switch (`<html lang="hi-IN">`);
  - **a challan booked with JavaScript off.**
- Our own first-load JS is about 10 KB gzipped (180 KB total on the login page, of which about 170 KB is the Next + React runtime).

### Not verified yet

- **Lighthouse** wasn't run: the auto-mode permission check blocked the run. Run it on `pnpm build && pnpm start -p 3100` after logging in.
- **Postgres / Supabase:** only the embedded database has been used; `DATABASE_URL` and `pnpm db:migrate` are untested against a real server.
- **On a phone:** not tested on a real phone (camera capture, WhatsApp hand-off, printing from a phone), and not with VoiceOver.
- **Hindi wording** needs a native speaker's read.

### Next

1. Utsav reviews locally: `SEED_DEMO=1 pnpm dev` on an empty `.data/`, password in `.env.local`.
2. Send the open points above to the client; match the print to their paper challan.
3. Deploy (needs Utsav's OK):
   1. create a Supabase project in Mumbai and run `DATABASE_URL=… pnpm db:migrate`;
   2. create a Vercel project (region `bom1`) with `APP_PASSWORD`, `DATABASE_URL` and `CRON_SECRET`;
   3. run Lighthouse on the live URL.
4. Add a commit and a GitHub remote when Utsav asks.
5. Phase 2 (doc section 5) only if needed.
