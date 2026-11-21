# Transport Desk: rules for Claude

Phase 1 of the Transport Management System for a single-office transport business in Kadodara (one admin, phone first, Hindi + English). Built by Kreative Knot. The client's feature document is `docs/Transport Management System Feature Document.docx`.

**Read first when resuming:** `docs/PROGRESS.md` (state, decisions, open points with the client, next steps).

These rules are the Sigma Marketing website rules (`~/Downloads/Personal/Sigma Marketing/CLAUDE.md`) adapted for a private data app. Where they differ, the reason is written next to the rule.

---

## 1. How to work

1. **Understand before writing.** Read the screen, the query and the action it touches. Reuse what exists (component, query, lib function, token) before adding anything.
2. **Pick the optimal solution, not the first one that works.** Aggregates in SQL (`sum`, `group by`, joined subqueries), never rows loaded to count in JS. No N+1: one query per list, parallel reads with `Promise.all`. Group with a `Map` in one pass, never `.find` inside `.map`.
3. **Smallest correct change.** No drive-by refactors, no features "for later". Extract on the third real repeat.
4. **Don't trust memory for framework APIs.** Next.js 16, React 19, Tailwind 4, Zod 4 and Drizzle changed many APIs. Check `node_modules/next/dist/docs/` before using an API you are not certain of.
5. **Verify, then say it's done.** `pnpm check`, then look at it in Chrome at 390 and 1440, in English and Hindi, and with JS off for forms. Report failures honestly.
6. **Log it.** After meaningful work, add an entry to `docs/PROGRESS.md`.
7. Ask only when a decision is the client's (formats, GST treatment, salary rules, wording). Otherwise choose the sensible default, say so, and add it to the open points.

## 2. Stack (exact versions in package.json, no `^`)

- **Next.js 16** (App Router, Turbopack, React Compiler), **React 19**, **TypeScript** strict.
- **Tailwind CSS 4** (`@theme static` in `app/globals.css`), no UI kits, no CSS-in-JS.
- **Postgres via Drizzle ORM.** Live: Supabase (Mumbai, Session pooler) through `DATABASE_URL`. Local: embedded PGlite in `.data/` (no setup). Migrations in `drizzle/` (`pnpm db:generate`, `pnpm db:migrate` for the live DB).
- **Zod** at every boundary (form data, search params, env). **No animation library**: CSS transitions only (Sigma allowed GSAP for marketing motion; a ledger tool doesn't need it).
- pnpm, Node 24 (`.nvmrc`), Vitest for `lib/`. Hosting: Vercel, region `bom1`, nightly backup cron in `vercel.json`.
- **Adding a dependency needs a reason** (bundle cost, what the platform already does). Excel export is CSV with a BOM (opens in Excel, keeps Hindi); PDF is the browser's print → Save as PDF. Both deliberately avoid a library.

## 3. Project structure

```
app/
  (desk)/            every signed-in screen, one folder per area (trips, challans, vendors, payments, expenses, salary, gst, reports, settings)
  login/             password screen (outside the shell)
  api/               bill photos, CSV export, backup download, nightly cron
components/
  ui/                primitives: Button, Field, Choice, Pill, PageHead, Rows, Stats, PeriodNav, Icon, PrintButton
  domain/            transport pieces: RouteRail, StatusStepper, TripRow, Money, Paper, ReportTable, History, CancelEntry
  forms/             client form islands (one per form) + useForm
  layout/            AppShell (sidebar / bottom tabs), NavLink, LangSwitch
content/             strings.en.ts, strings.hi.ts (every label; hi must match en's keys)
lib/                 pure functions with tests: money, gst, salary, ledger, dates, csv, words, session, whatsapp
server/
  db/                schema, connection, local demo seed
  queries/           reads, one file per area
  actions/           "use server" mutations, one file per area
proxy.ts             the login guard (Next 16 name for middleware)
```

- One component per file, named export, file name = component name. Import with `@/`.
- Files under ~250 lines. Labels live in `content/`, never hard-coded in components.

## 4. TypeScript

- `strict`, `noUncheckedIndexedAccess`. **No `any`, no `as` casts, no `@ts-ignore`.** Use type guards, `satisfies`, discriminated unions.
- Fixed choices are `as const` arrays in `lib/types.ts`; Zod enums, labels and DB columns all use them.

## 5. React and Next.js rules

- **Server components by default.** `"use client"` only on the smallest interactive leaf (forms, NavLink, PrintButton, BillPhoto). Pass only the string groups a client form needs (`t.common`, `t.challans`), never the whole dictionary.
- **Every page is dynamic on purpose** (`ƒ` in the build): it shows the admin's live data and their language cookie. Don't add `"use cache"` to data reads without a revalidation plan.
- **Forms work without JS.** Plain `<form action={serverAction}>`, `useActionState` via `components/forms/useForm.ts`, `defaultValue` from the returned values so a refused save keeps what was typed. Show/hide by CSS `:has()` where possible (new party fields, "received by", GST rate). The New challan steps only switch on after hydration; without JS it is one long form.
- **Writes:** every action calls `assertAdmin()`, validates with Zod, runs in a transaction, and writes `logChange()` inside that transaction. Then `refreshDesk()` and `redirect()`.
- **Nothing is deleted.** Challans, payments and expenses are cancelled (stay visible, leave every total). Trucks, drivers, parties and staff are hidden. Amounts on a challan can't be edited; cancel and rebook so the ledger stays true.
- Don't store derived values in state; don't sync state with effects. React Compiler is on: no hand-written `useMemo`/`useCallback`.

## 6. Data rules

- **Money is integer paise**, everywhere. Convert only in `lib/money.ts` (`parseRupees`, `formatMoney`). GST rates are basis points (5% = 500).
- GST is split once at booking (`lib/gst.ts`) and stored (`taxable`, `gstAmount`, `total`), so a later rate change never rewrites old challans.
- Challan numbers come from `settings.nextChallanNo`, incremented inside the booking transaction. The number can only move forward.
- Who owes a challan (`partyId`): the sender for Paid and Billed later, the receiver for To-Pay. Paid challans record their payment at booking.
- "Today" and months are IST (`lib/dates.ts`), never UTC midnight.
- Salary is frozen per month (`salary_months.monthly_salary`); the formula is `lib/salary.ts`, shared by the form's live preview and the server.

## 7. Design rules

- **Phone first.** Bottom tab bar (Home, Trips, + New, Parties, More) under 1024 px, sidebar above. Touch targets ≥ 44 px (buttons 48 px), fields 17 px text, one task per screen.
- **Rows, not card grids**, for lists. Big tap choices (`Choice`) instead of dropdowns when there are 2–4 options; native `<select>` for longer lists (best picker on phones); `<datalist>` for places typed before.
- **Tokens only** (`app/globals.css`): paper grounds, ink text, one action colour (`signal`), green for money received, red for money owed, amber for part paid. Status always has a word next to its colour. No raw hex in components.
- The **route rail** (truck on a dashed road between two places) is the tool's signature; the dark `road` ground is for the day's summary and trip status only.
- Print: `data-chrome` / `data-no-print` hide the app around the A4 `Paper`. Every printable record has a Print button and, where it goes to a party, a WhatsApp button (`wa.me` link with the text ready).
- Hindi: every label in `content/strings.hi.ts`; trade words (challan, bilty, To-Pay, udhaar) stay as people say them. Check Hindi screens for overflow after any layout change.

## 7a. The flow (every screen follows it)

The desk is built around one five-step flow, defined in `lib/flow.ts`: **1 Book → 2 Load → 3 On the road → 4 Deliver → 5 Collect**.

- **Home is the work board** (`FlowBoard`): the five steps in order. Each shows what is waiting and exactly one button. Office work (expenses, salary, reports) sits below it, apart from the flow.
- **Every record and form on the flow starts with `FlowBar`** ("you are here"), and every record shows **one next action**:
  - a challan shows the `NextStep` card;
  - a trip shows the big button in `TripNextAction`.
  - Corrections live under "Correct the status", never as the main control.
- **Trip screens change by stage:**
  - loading: a checklist of waiting parcels to load (`LoadPanel`), and a parcel can be taken off;
  - on the road: one button;
  - arrived: each parcel is delivered, with To-Pay money taken in the same tap;
  - all delivered: close.
- **New work must fit a step or "Office work".** If a feature doesn't belong to one, discuss it before building.

## 7b. Practice desk and guided tour

- **The practice desk** (cookie `td_practice`) is a separate database with sample data (`server/db/sample.ts`):
  - locally, PGlite in `.data/practice`;
  - on Postgres, the `practice` schema, migrated by `migratePracticeSchema`. It refuses to run if `search_path` isn't honoured.
  - `getDb()` picks the database per request. Cron and backups always use the real one.
  - A banner is always visible while on it.
- **The guided tour** is data in `lib/tour.ts`. It runs only on the practice desk, and each step waits for the person to act (click, pick, type) before moving on.
  - Steps point at `data-tour="…"` hooks. **When you change a screen the tour visits, keep its hook and re-run the tour** (playwright script pattern in `docs/PROGRESS.md`).
  - Tour text lives in `content/strings.*.ts` under `tour.steps`, in both languages.
  - The overlay is code-split and positions itself with refs in `requestAnimationFrame`, never with React state.

## 8. Performance budget

| Metric (mobile)                                                          | Must                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Lighthouse Performance / Accessibility / Best Practices                  | ≥ 90 / 100 / 100                                                         |
| Our own first-load JS (gzip, on top of the ~170 KB Next + React runtime) | ≤ 30 KB                                                                  |
| Any list query                                                           | one SQL round trip, capped (`limit`)                                     |
| Bill photos                                                              | shrunk in the browser to ≤ 1600 px JPEG before upload; ≤ 1.5 MB accepted |

Animate only `transform` and `opacity` (and colours on hover). No layout animation on lists.

## 9. Accessibility (WCAG 2.2 AA)

Semantic HTML, one `h1` per page, labels on every field, errors tied with `aria-describedby` and announced, skip link, visible focus ring, `lang` on `<html>` follows the language switch. Never colour alone.

## 10. Security

- One admin password (`APP_PASSWORD`), stateless signed session cookie (`lib/session.ts`), checked in `proxy.ts` **and** in every server action. Changing the password signs everyone out. Login is rate-limited.
- Security headers + CSP in `next.config.ts`; `noindex` on everything. Uploads are sniffed by magic bytes (`lib/image.ts`), never trusted by extension or claimed type.
- Secrets only in Vercel env vars; `.env*` ignored; `.env.example` lists names. The live tool refuses to start without `DATABASE_URL` (never falls back to a throwaway disk DB).
- Nightly backup (`/api/cron/backup`, `CRON_SECRET`) keeps the last 30 gzip snapshots in the DB; Settings → Backup downloads one any time.

## 11. Checks

`pnpm check` = typecheck + lint (0 warnings) + tests + build. Then Chrome at 390 and 1440, English and Hindi, a no-JS pass on any changed form. Local demo data: `SEED_DEMO=1 pnpm dev` on an empty `.data/` (delete `.data/` to start fresh).

## 12. Git

Branch, never `main` directly. Commit only when Utsav asks. Conventional messages (`feat(challans): ...`).

## 13. Never

- Never hard-delete business records, or let an edit skip the audit log.
- Never use floating-point rupees, or recompute stored GST.
- Never invent the client's formats, rates or rules: mark them as open points in PROGRESS.md.
- Never use `any`, `as` casts, `@ts-ignore`, or a lint-disable without a one-line reason.
