# Transport Desk Phase 2: from one business to a product

Status: **draft for discussion**, 2026-11-24. Phase 1 (one business, Next.js server actions, Supabase) is the MVP running for the first client. This document lists the backend changes needed to sell it to many businesses. Each section marks the **decision** and the reason. The open questions are in §11.

---

## 1. Goals and limits

**Goals**

- Many businesses (organisations) on one deployment, each fully isolated from the others.
- 10–15 users per business: admin, office, drivers, helpers. All on the web app, used on phones and desktops.
- A dedicated backend (API) that the web app and any later client (native app, partner API) share.
- Admins control logins and sessions: create users, invite links, see who is active, revoke devices, limit sessions.
- Production on plain Postgres with no dependency on one provider. Supabase is used for staging and multi-user testing only.

**Expected load:** 50 organisations × 15 users = 750 users. At a busy 5 saves per minute per person, that's about 60 writes a second at peak. One Postgres instance and one API instance handle this with a lot of room to spare. **The hard part is isolating businesses from each other, not load.** Every design choice below favours isolation and simplicity over scale-out.

**Not in phase 2:** a native mobile app, microservices, multi-region, offline mode, a public partner API. The design leaves room for each one (§10).

---

## 2. Target architecture

```
 Browser (phone / desktop) ── same site: app.<domain> + api.<domain>, or one domain with /api ──┐
        │  pages, forms (work without JS)                                                        │
        ▼                                                                                        │
 apps/web  (Next.js, frontend + BFF)                                                             │
   server components / server actions ──HTTP + forwarded session cookie──▶ apps/api (Fastify)  ◀─┘ (/api/auth/* direct)
   no database access                                                       │  modules (modular monolith)
                                                                            │  Better Auth, tenant context, jobs
                                                                            ▼
                                                     Postgres (prod: managed PG in Mumbai; staging: Supabase)
                                                     Object storage (bill photos, exports, backups)
```

**Decision: Next.js becomes the frontend and a backend-for-frontend (BFF), and Fastify owns all data.**

- Server actions remain the way forms post, so **forms keep working without JS**, which the client's phones need. Each action becomes a thin call to the API: validate the input shape, call the API, then redirect or return a `FormState`.
- `apps/web` must not import `packages/db`; a lint rule enforces it. Every read and write goes through the API, so a later native app or partner gets the same rules.
- Web to API is server to server in the same region, adding about 1–5 ms per hop. The browser calls the API directly only for `/api/auth/*`, and for photo uploads through presigned URLs (§8.2).

**Hosting:**

| Piece                | Recommended                                                                                      | Why                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `apps/api` (Fastify) | a long-running container in Mumbai (Railway, Render, Fly.io, or AWS App Runner/ECS `ap-south-1`) | persistent database pool, background jobs in the same process, no cold starts |
| `apps/web`           | Vercel `bom1` (as today) or the same container host                                              | unchanged frontend workflow                                                   |
| Postgres             | §6                                                                                               |                                                                               |

---

## 3. Repository: modular monolith with pnpm workspaces

```
apps/
  web/                 Next.js (today's app/, components/, content/ move here)
  api/                 Fastify
    src/
      modules/         one folder per area: public index.ts, routes, service, repo
        challans/ trips/ parties/ money/ salary/ reports/ settings/
        users/ sessions/ orgs/ audit/ files/ backups/
      plugins/         auth, tenant context, errors, rate limit, request log
      jobs/            pg-boss queue: workers + schedules (exports, backups, reminders, cleanup)
      server.ts
packages/
  config/              shared tsconfig bases, ESLint, Prettier, Vitest presets, env loading (zod)
  domain/              pure logic, no I/O: money, gst, salary, ledger, dates, flow, challan-no, words, csv,
                       permission catalog (today's lib/access.ts), fixed choices (lib/types.ts)
  contracts/           zod request/response schemas + typed API client used by apps/web
  db/                  Drizzle schema, migrations, client factory, withTenant(), PGlite test fixtures
  auth/                Better Auth config, shared by api (server) and web (types and cookie names)
```

**Module rules** (these keep the monolith modular, so a module can become a separate service later):

1. A module exposes only its `index.ts` (service functions and types). Other modules never import its repo or tables.
2. A module reaches another module's data through that module's service, never with a cross-module join written in a different module. Report queries may read across modules, but only inside `modules/reports`.
3. Every service function takes `ctx = { actor, orgId, tx, requestId }` as its first argument. Routes, jobs and tests all call the same function.
4. Dependency rules are checked in CI with dependency-cruiser or ESLint `import/no-restricted-paths`:
   - `web` must not import `db`;
   - a module must not import another module's internals;
   - `domain` imports nothing.

**Tooling:**

- pnpm workspaces plus **Turborepo** to cache typecheck, lint, test and build across packages.
- `packages/contracts` gives web and API one source of truth for input shapes. Today the same Zod schemas sit inside actions.

**What moves from phase 1:**

| Phase 1                                       | Phase 2                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `lib/*` (pure functions)                      | `packages/domain`                                                          |
| `server/db/*`                                 | `packages/db`                                                              |
| `server/actions/*` (business logic)           | `apps/api/src/modules/*/service.ts`                                        |
| `server/queries/*`                            | `apps/api/src/modules/*/repo.ts`                                           |
| `server/auth.ts` (access checks)              | the API's auth plugin plus `ctx.actor`; `can()` stays in `packages/domain` |
| `server/guard.ts` (`guardForm`, failure refs) | the API's error handler plus the web's API client mapping                  |

---

## 4. Many businesses (multi-tenancy)

**Decision: one database and one schema, an `org_id` column on every business table, enforced twice.** Isolation is checked by the code and by Postgres row-level security.

- A new `organizations` table holds id, name, slug, status (`active` / `suspended`), plan, `is_demo`, and created time.
- **`org_id` on every business table:**
  - trucks, staff, trips, vendors, challans, payments, expenses, bill_photos, salary_months, settings, audit_log, backups;
  - roles and role_permissions, so each org can edit its own roles, starting from the default templates in `packages/domain`.
- **Composite keys:**
  - foreign keys become `(org_id, id)`, so a challan can never reference another org's party or trip;
  - `unique(org_id, no)` for challan numbers, with `org_id` first in every index.
- **Settings and challan numbering become per org:** `settings` is keyed by `org_id`, and `next_challan_no` is incremented per org in the booking transaction, as today.
- **Row-level security that actually applies:**
  - the API connects as a role **without BYPASSRLS**, separate from the role that runs migrations;
  - every table gets `FORCE ROW LEVEL SECURITY` and a policy `org_id = current_setting('app.org_id')::int`;
  - `withTenant(orgId, fn)` in `packages/db` opens a transaction, runs `select set_config('app.org_id', $1, true)` (local to that transaction, so it is pooler-safe), then runs `fn(tx)`;
  - the code **also** filters by `org_id`. RLS catches the query someone forgets.
- **Platform admins** (Kreative Knot) are separate from org admins. They use a separate console, and only a dedicated role may bypass the tenant policy; every use is written to the audit log.
- **The practice desk becomes a demo org.** Each org gets a linked `is_demo` sandbox with sample data, which removes the separate `practice` schema and `migratePracticeSchema`. The guided tour runs unchanged against it.
- **Mandatory test:** for every table and every list or read endpoint, a user of org A gets nothing from org B, whether through an id in the URL, a filter, an export, a photo or a backup download. It runs in CI and blocks merge.

---

## 5. Authentication and sessions (Better Auth)

### 5.1 Decision

**Use Better Auth with server-side sessions in Postgres and an httpOnly cookie. No JWT access/refresh tokens.**

- The product is one web app used in phone and desktop browsers, so a cookie works everywhere and forms still work without JS.
- Session rows make per-device revocation and device lists possible.
- Supabase Auth is not used. It expects an email or phone (drivers log in by name), has no organisations, and a JWT can only be revoked when it expires. The full comparison is in the 2026-11-24 conversation, summarised in §11.

Plugins:

| Plugin       | Used for                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------- |
| username     | login by name (drivers have no email; store a placeholder email if the version requires one) |
| organization | membership, active org on the session, invitations                                           |
| admin        | ban or unban, list and revoke a user's sessions, platform "view as"                          |
| twoFactor    | TOTP for org admins and platform admins (required for platform, optional for org admins)     |
| bearer / jwt | **not now**; only if a native app or another-domain service appears (§10)                    |

**Pin the Better Auth version.** Check plugin names and options against the installed version's docs before building.

### 5.2 Getting users in

1. **The admin creates a user (stays as today).** The admin picks a name, role and temporary password, and the user must change it at first sign-in (`mustChangePassword`). A driver login must link to a Staff driver.
2. **Invite link (new):**
   - the admin chooses the role, and the staff link for drivers;
   - the system makes a single-use link that expires after 72 hours (time to be decided);
   - the admin shares it by WhatsApp (`wa.me`, the same pattern as challans) or copies it;
   - the person opens it, picks a login name and password, and joins the org;
   - links can be revoked, and are listed under Users as "pending".
3. **Organisation onboarding (new, replaces the `APP_PASSWORD` setup key):** a platform admin creates the org and an invite for its first admin. Self sign-up comes later (§11).
4. **Password reset:** admin-driven, as today. A reset signs that user out everywhere. There is no email reset for name-only users.
5. **Migrating phase-1 users:** keep their scrypt hashes through Better Auth's custom `verify` function, then rehash on next login. Everyone signs in once more after the cut-over.

### 5.3 Session policy

| Setting                                 | Default (proposed, client to confirm)                                     | Where configured  |
| --------------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| Session lifetime                        | 30 days, **renewed by use** (sliding)                                     | platform          |
| Idle timeout                            | admin 7 days, others 30 days                                              | per org           |
| Maximum sessions per user               | admin 3, office 3, driver 2, helper 2                                     | per org, per role |
| When the limit is reached               | **sign out the oldest session** (proposed) and record it in the audit log | per org           |
| Cookie cache (skips the database check) | 5 minutes; skipped for admin actions and session management               | platform          |
| Cookie                                  | `httpOnly`, `Secure`, `SameSite=Lax`, scoped to the product domain        | platform          |

The maximum and the idle timeout are enforced with Better Auth hooks (`session.create`, and a check in the tenant plugin), not by its defaults.

### 5.4 Admin session management (new screens: Settings → Users → Sessions)

- **Who is active now:** users with a request in the last 15 minutes.
  - `last_seen_at` is updated on the session row **at most once every 5 minutes**, so it doesn't write on every request.
  - Shown as a green "Active now", or as "last seen 2 h ago".
- **A user's sessions:** device (from the browser's user agent: "Chrome · Android"), approximate place from IP (optional), signed-in time, last active.
- **Actions:**
  - revoke one session;
  - revoke all of a user's sessions;
  - switch a user off, which revokes all their sessions and blocks new sign-ins;
  - "sign out everyone in the org" (for a leaked password or a staff change).
- **Each user's own "My devices"** page: see and revoke their own sessions, and "sign out other devices".
- **Audit events (shown in History):**
  - sign-in success;
  - failed sign-in (counted, not stored row by row);
  - a new device;
  - session revoked (by whom);
  - limit reached and oldest session signed out;
  - invite created, used, or revoked;
  - password changed or reset;
  - 2FA turned on or off.
- **Optional, decided per org:** notify the admin when someone signs in from a new device. This exposes shared logins, the most likely real misuse in a small office.

### 5.5 Authorisation stays ours

`can()`, the permission catalog and role templates stay in `packages/domain`. Better Auth answers **who** someone is and which org is active. The API's auth plugin builds `ctx.actor` (user, org, roles, permissions) in one query. Every route declares its permission:

```ts
app.post(
  "/v1/challans",
  { config: { permission: "challans.create" }, schema: { body: CreateChallan } },
  handler,
);
```

A test fails if a route has no permission, as phase 1 does for actions. Driver trip scoping (`tripScope`) moves into the trips service.

---

## 6. Database

**Decision: plain Postgres in production, managed, in India. No provider-specific features.**

| Option                                     | Notes                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| **AWS RDS / Aurora Postgres `ap-south-1`** | point-in-time recovery, mature, needs AWS setup (VPC, security groups) |
| DigitalOcean Managed Postgres (Bangalore)  | simpler and cheaper, has PITR and a built-in PgBouncer                 |
| Neon (if an India region is available)     | branching is useful for previews; check the region and latency         |
| Self-hosted on a VM                        | not recommended: backups, failover and patching become our job         |

Requirements for any choice:

- an India region, near the API;
- point-in-time recovery of 7 days or more;
- automated daily snapshots;
- TLS;
- a pooler if many API instances run;
- separate roles for migrations (owner) and the app (no BYPASSRLS).

**Staging and multi-user testing on Supabase:**

- It only works as plain Postgres: Data API off and RLS on, as phase 1 does today.
- No Supabase Auth, Storage or Realtime. Otherwise staging stops matching production.

**Migrations:**

- Drizzle Kit, run as a separate deploy step with the owner role, before the new API version starts.
- Follow **expand → migrate → contract**: add the column, deploy code that writes both, backfill, then remove the old column in a later release. Migrations are never edited after they run anywhere shared.

**Connection pool:**

- The Fastify container keeps one `postgres` pool per instance, about 10 connections.
- A transaction-mode pooler is needed only beyond a few instances, and `set_config(..., true)` is safe with one.

**Indexes:** `org_id` first. Every list query has a `limit`, and pagination is cursor-based (§7).

---

## 7. API design and routes

REST over JSON. Fastify's zod type provider uses the schemas from `packages/contracts`, and OpenAPI is generated from them (`@fastify/swagger`). The typed client for `apps/web` is generated from the same source.

### 7.1 Identifiers: no sequential ids in URLs

**Today**, records are addressed by auto-increment ids: `/challans/12`, `/settings/users/34`, `/api/bill/7`, `/api/backup/3`. For one business this is harmless, because every request is access-checked. As a product it is a problem:

- **It leaks business volume.** Ids are global across organisations, so a new customer's first challan being `/challans/48213` tells them how much everyone else books, and `users/34` says how many logins exist on the platform.
- **It invites probing.** Anyone can try `…/48212`, `…/48214`. With access checks and RLS this returns nothing, but enumeration makes any missed check immediately exploitable.
- **It breaks across environments.** Ids clash when an org's data is exported, imported, or moved between databases.

**Decision: every table gets two identifiers, and people get a third.**

| Identifier                         | Type              | Used for                                                                                                                      |
| ---------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`                               | `bigint` identity | internal only: primary key, foreign keys, joins. **Never leaves the API.**                                                    |
| `public_id`                        | UUIDv7, unique    | URLs, API requests and responses, links, exports                                                                              |
| Human number (challan no, trip no) | integer per org   | what people say, print and send on WhatsApp ("challan 1042"); searchable with `?no=1042`, never used as an identifier in URLs |

- **Why UUIDv7:**
  - unguessable in practice (74 random bits), so ids can't be enumerated;
  - time-ordered, so it indexes well and works as a pagination cursor;
  - generated in the app (or with `uuidv7()` on Postgres 18+).
- **Optional:** type-prefixed ids in API output (`chl_01jd…`, `usr_01jd…`, the TypeID style) make logs and support tickets easier to read. Decision §11.
- **Web pages follow the API:** `/challans/0193f6c2-…`. Nobody types these; people find records by challan number, party or search.
- **Not found and not allowed look the same.** A record from another org returns **404**, exactly as if it didn't exist, so the API never confirms that someone else's record exists. **403** is only for a record in your own org that your role may not touch.
- **Nothing internal leaves the API.** Responses never contain `id`, `org_id`, password hashes, session tokens or the internal role or permission ids. References use public ids plus a label: `"truck": { "id": "0193…", "number": "GJ05 AB 1234" }`.

### 7.2 Route conventions

**Paths**

- **Base and versioning:** `https://api.<domain>/v1/…`. Additive changes (new fields, new routes) stay on `v1`. A breaking change means `/v2`, run alongside `v1` for a stated period.
- **Resources are plural nouns in kebab-case:** `/v1/challans`, `/v1/salary-months`, `/v1/bill-photos`. Verbs never appear in paths, except for the actions below.
- **The org comes from the session** (the active org), never from the URL, so one org can't be swapped for another by editing a path. Only platform routes carry it: `/v1/platform/orgs/{orgId}`.
- **The signed-in user is `/v1/me`**, for example `/v1/me/sessions`, instead of passing their own id.
- **At most one level of nesting**, and only when the child belongs to the parent: `/v1/trips/{tripId}/challans`, `/v1/users/{userId}/sessions`. Anything else is top-level with a filter: `/v1/payments?partyId=…`, not `/v1/parties/{id}/payments/{id}`.

**Methods**

| Method              | Use                                                                                | Success                                        |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| `GET`               | read; never changes anything                                                       | `200`                                          |
| `POST` (collection) | create                                                                             | `201` + `Location` header + the created record |
| `PATCH`             | change some fields; needs `If-Match` (§7.4)                                        | `200` + the record                             |
| `PUT`               | create-or-replace on a natural key, e.g. one staff member's salary for one month   | `200` / `201`                                  |
| `DELETE`            | only things that are truly removable: sessions, invites, a parcel's link to a trip | `204`                                          |
| `POST …/{action}`   | a state change that is more than a field edit                                      | `200` + the record                             |

**Business records are never deleted**, as in phase 1:

- **Cancelling is an action:** `POST /v1/challans/{id}/cancel` with a reason.
- **Hiding a truck, party or staff member is a field change:** `PATCH { "active": false }`.
- **Each step of the five-step flow is an action** (`…/depart`, `…/arrive`, `…/deliver`). Each checks the current state and returns `409` if the step isn't allowed from there, so the rules live in one place and every step is audited.

**Lists**

- Filters as query parameters: `?status=delivered&from=2026-11-01&to=2026-11-30`. Sort with `?sort=-bookedAt` (`-` means descending), search with `?q=`.
- Cursor pagination: `?limit=50&cursor=…`, with `limit` capped at 100. The response is always:

  ```json
  { "data": [ … ], "nextCursor": "0193f6c2-…" }
  ```

  `nextCursor` is `null` on the last page. Totals aren't included by default because they cost a second query; a screen that needs one asks with `?include=total`.

**Fields**

- JSON field names are `camelCase`.
- Money is integer paise, with the unit in the name: `freightPaise`, `totalPaise`. Nothing leaves the API as rupee floats.
- Business dates are `YYYY-MM-DD` in IST (`lib/dates.ts` rules). Timestamps are ISO 8601 with an offset (`2026-11-24T18:30:00+05:30`).
- Fixed choices are lowercase strings from `packages/domain` (`to_pay`, `paid`, `billed`), listed as enums in OpenAPI.

**Headers**

| Header                       | Use                                                |
| ---------------------------- | -------------------------------------------------- |
| `Idempotency-Key`            | on every create; a repeat returns the first result |
| `ETag` / `If-Match`          | record version; a stale edit gets `412`            |
| `X-Request-Id`               | accepted or generated; echoed back and logged      |
| `RateLimit-*`, `Retry-After` | on limited routes and on `429`                     |
| `Cache-Control: no-store`    | on all org data                                    |

**Sensitive values never go in URLs**, because proxies, logs and browser history keep URLs:

- passwords, tokens and phone numbers go in the body or headers;
- the one exception is the **invite link**: its token is single-use, expires (§5.2), and the landing page exchanges it at once with a `POST` and redirects to a clean URL. That page sends `Referrer-Policy: no-referrer`.

**Files and exports**

- Photo upload:
  1. `POST /v1/expenses/{id}/bill-photo/upload-url` returns a presigned upload URL;
  2. the browser uploads the photo straight to storage;
  3. `PUT /v1/expenses/{id}/bill-photo` records it.
- Photo view: `GET /v1/expenses/{id}/bill-photo` returns `302` to a signed URL valid for 60 s, after the access check.
- Small reports: `GET /v1/reports/{report}?from=…&to=…&format=csv` streams the file.
- Large exports: `POST /v1/exports` returns `202`, then `GET /v1/exports/{id}` gives the status and download link.

**Docs:** `/v1/openapi.json` always; the interactive docs UI only on staging, or behind platform-admin sign-in.

### 7.3 Route catalogue (first draft)

`{…Id}` is always a `public_id`. Every route declares a permission (§5.5).

| Area                            | Routes                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth** (Better Auth, mounted) | `/v1/auth/*`: sign in by name, sign out, accept invite (token in the body), 2FA                                                                                                                                                                                     |
| **Me**                          | `GET /v1/me` (user, active org, roles, permissions: the web hides controls from this) · `POST /v1/me/password` · `GET /v1/me/sessions` · `DELETE /v1/me/sessions/{sessionId}` · `POST /v1/me/sessions/revoke-others`                                                |
| **Users** (admin)               | `GET, POST /v1/users` · `GET, PATCH /v1/users/{userId}` · `POST /v1/users/{userId}/deactivate` · `…/activate` · `…/reset-password`                                                                                                                                  |
| **Sessions** (admin)            | `GET /v1/sessions?activeWithin=15m` (who is active) · `GET /v1/users/{userId}/sessions` · `DELETE /v1/users/{userId}/sessions` (all of one user's) · `DELETE /v1/sessions/{sessionId}` · `POST /v1/sessions/revoke-all` (the whole org)                             |
| **Invites** (admin)             | `GET, POST /v1/invites` · `DELETE /v1/invites/{inviteId}`                                                                                                                                                                                                           |
| **Roles** (admin)               | `GET, POST /v1/roles` · `PATCH /v1/roles/{roleId}` · `GET /v1/permissions`                                                                                                                                                                                          |
| **Masters**                     | `GET, POST /v1/trucks` · `GET, PATCH /v1/trucks/{truckId}` · the same for `/v1/staff` (`?role=driver&onPayroll=true`) and `/v1/parties`                                                                                                                             |
| **Challans**                    | `GET /v1/challans` (`?status`, `?no`, `?partyId`, `?tripId`, `?from`, `?to`, `?q`) · `POST /v1/challans` · `GET, PATCH /v1/challans/{challanId}` (fields other than amounts) · `POST /v1/challans/{challanId}/cancel` · `…/deliver` (received by, To-Pay collected) |
| **Trips**                       | `GET, POST /v1/trips` · `GET, PATCH /v1/trips/{tripId}` · `POST /v1/trips/{tripId}/challans` (load) · `DELETE /v1/trips/{tripId}/challans/{challanId}` (take off) · `POST /v1/trips/{tripId}/depart` · `…/arrive` · `…/close`                                       |
| **Money**                       | `GET, POST /v1/payments` · `POST /v1/payments/{paymentId}/cancel` · `GET, POST /v1/expenses` · `POST /v1/expenses/{expenseId}/cancel` · bill photo routes (§7.2)                                                                                                    |
| **Salary**                      | `GET /v1/salary-months?month=2026-11` · `PUT /v1/staff/{staffId}/salary-months/2026-11` (one month's entry; the same request twice gives the same result)                                                                                                           |
| **Reports**                     | `GET /v1/reports/{cash-book \| outstanding \| trip-profit \| expenses \| gst \| salary-register}?from&to&format=json\|csv` · `POST /v1/exports`                                                                                                                     |
| **Settings**                    | `GET, PATCH /v1/settings`                                                                                                                                                                                                                                           |
| **History**                     | `GET /v1/audit?entity=challan&entityId={challanId}`                                                                                                                                                                                                                 |
| **Backups** (admin)             | `GET /v1/backups` · `GET /v1/backups/{backupId}/download`                                                                                                                                                                                                           |
| **Platform**                    | `/v1/platform/orgs` (`GET, POST`) · `/v1/platform/orgs/{orgId}` (`GET, PATCH`) · `…/suspend` · `…/view-as`                                                                                                                                                          |
| **Health**                      | `GET /health` · `GET /ready`; no version, no sign-in, no details in the response                                                                                                                                                                                    |

### 7.4 Errors, retries, concurrency and limits

- **One error format for every failure: RFC 9457 `application/problem+json`.** It carries phase 1's `guardForm` ideas over to the API:

  ```json
  {
    "type": "https://api.<domain>/problems/validation",
    "title": "Some fields need fixing",
    "status": 422,
    "code": "validation",
    "errors": { "freightPaise": "required" },
    "ref": "ab12cd34"
  }
  ```

  | Status    | `code`                      | When                                                                                   |
  | --------- | --------------------------- | -------------------------------------------------------------------------------------- |
  | 400       | `bad_request`               | malformed JSON or parameters                                                           |
  | 401       | `unauthenticated`           | no session, or it was revoked                                                          |
  | 403       | `forbidden`                 | a record in your org that your role can't touch                                        |
  | 404       | `not_found`                 | missing, **or in another org** (§7.1)                                                  |
  | 409       | `conflict`                  | a flow step not allowed from the current state, or a duplicate (e.g. login name taken) |
  | 412       | `stale`                     | `If-Match` doesn't match: someone else edited it first                                 |
  | 413 / 415 | `too_large` / `unsupported` | body size or type                                                                      |
  | 422       | `validation`                | the input failed the schema; `errors` per field                                        |
  | 429       | `rate_limited`              | with `Retry-After`                                                                     |
  | 500 / 503 | `server` / `busy`           | always with a `ref`; the details are only in the logs                                  |
  - raw database or driver errors never reach the response; they are logged with the `ref`;
  - the web maps the codes to today's `FormState` failures (`denied`, `busy`, `taken`, `server`) and field errors.

- **Idempotency keys on creates** (bookings, payments, expenses): the form carries a one-time key, and a repeated submit, from a double tap or a retry on poor 4G, returns the first result instead of creating a second challan.
- **Optimistic concurrency on edits:**
  - every editable table gets a `version` column, sent to the client as the `ETag`;
  - a `PATCH` must send it back in `If-Match`;
  - if two office users edit the same party at once, the second gets `412 stale` and the form shows the new values, instead of silently overwriting the first edit.
- **Request limits:**
  - body size 100 KB for JSON, and photos go to object storage directly (§8.2);
  - a timeout on every route;
  - the 15 s database statement timeout kept from phase 1.

---

## 8. Other backend changes

### 8.1 Security

- **Rate limits** (`@fastify/rate-limit`, stored in Postgres or Redis so they are shared across instances, fixing phase-1 open point 11):
  - login: per name, per IP, per org;
  - invites, writes and exports: per org.
- **Headers and origins:**
  - `@fastify/helmet`;
  - CORS restricted to the web origin;
  - an origin check on cookie-authenticated writes (Better Auth checks the origin itself, and `SameSite=Lax` adds a second layer);
  - the web keeps its CSP from `next.config.ts`.
- **Secrets** in the host's secret store; env validated with zod at start-up (`packages/config`), so the server refuses to start with a missing or weak secret.
- **Uploads:** checked by magic bytes as in phase 1 (`lib/image.ts`), size-capped, stored under a per-org prefix, and served only through short-lived signed URLs after an access check.
- **Dependencies:** `pnpm audit` in CI, Renovate or Dependabot, exact pinned versions (as in phase 1).
- **Audit log:** `org_id`, actor, IP and user agent on every entry. It can only be appended to: the app role has no UPDATE or DELETE on it.
- **Data protection:**
  - per-org data export, and an org deletion path (suspend → export → delete after N days);
  - check what India's DPDP Act 2023 requires for staff personal data such as salary and phone numbers.

### 8.2 Files

**Bill photos move from Postgres `bytea` to S3-compatible object storage** (S3 `ap-south-1` or Cloudflare R2):

- the browser shrinks the photo as today, asks the API for a presigned upload URL, and uploads straight to storage;
- the API records the key;
- a one-time job moves the existing `bytea` photos.

### 8.3 Background jobs (pg-boss queue)

**Decision: heavy, slow and scheduled work runs on a pg-boss queue, never inside a request.**

- pg-boss keeps its queue in the same Postgres (its own `pgboss` schema), so there is no Redis or extra service to run, back up or secure.
- Postgres `SKIP LOCKED` lets several workers take jobs without taking the same one twice.

**What goes on the queue.** A request does the minimum that the person must see succeed, records the job, and answers at once. Anything that matches one of these goes on the queue:

| Rule                                                          | Examples                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| takes more than about 2 s, or grows with the size of the data | large report and CSV exports, the GST period summary, a full backup                                                     |
| calls an outside service that can be slow or down             | WhatsApp or SMS messages, email, object-storage copies                                                                  |
| must retry if it fails                                        | sending a reminder, uploading a backup                                                                                  |
| runs on a schedule                                            | nightly backups, daily overdue reminders, monthly salary month set-up                                                   |
| fans out to many organisations                                | "for every org: back up / remind / clean up"                                                                            |
| housekeeping                                                  | delete expired sessions, invites and idempotency keys; move the existing `bytea` photos (§8.2); remove old export files |

**What stays in the request:** booking a challan, recording a payment, every step of the five-step flow. These are fast, and the person must know at once that they saved.

**How jobs are built**

- **Enqueue in the same transaction as the business write.** pg-boss can send through the caller's database connection. If the booking rolls back, its job disappears with it, and a job never exists for a row that was never saved. Check the exact option in the pinned version.
- **The payload holds only ids and the org:** `{ orgId, exportId, requestedBy }`, never whole records or personal data. The worker reads fresh data itself.
- **Workers run in the tenant context:** each handler starts with `withTenant(orgId, …)` (§4), so RLS applies to background work exactly as it does to requests.
- **Every handler is idempotent.** pg-boss delivers at least once, so a job can run twice after a crash. Handlers check "already done?" first: an export with a file, a reminder already sent today.
- **Retries:** a retry limit with exponential backoff for each queue, plus a timeout (`expireIn`) so a stuck job is retried instead of blocking the queue.
- **Failed jobs go to a dead-letter queue.** They are kept, shown on the platform console with their error `ref`, and can be retried by hand.
- **No duplicates:** singleton or debounce keys stop a job being queued twice, e.g. one export per org, report and date range at a time.
- **Fairness between orgs:** per-queue concurrency limits, plus a per-org limit for heavy queues, so one org exporting a year of data can't hold up everyone's backups. User-requested jobs get a higher priority than nightly batch work.
- **Schedules live in code:** pg-boss `schedule()` with IST cron times, kept in `apps/api/src/jobs/schedules.ts`. This replaces Vercel cron and `CRON_SECRET`.

**Jobs the user waits for** (exports and other large reports):

1. `POST /v1/exports` creates an `exports` row (status `queued`), sends the job in the same transaction, and returns **`202`** with the export's id (§7.2).
2. The worker sets the status to `running`, then `done` (with a file in object storage) or `failed` (with a `ref`).
3. The screen shows "Preparing your report…" and checks `GET /v1/exports/{id}`. When it's done, it shows a download link: a signed URL that expires. Without JS, the page refreshes itself with a meta refresh.
4. Files are deleted after 7 days by a cleanup job.

**Where workers run**

- **Start:** inside the API process (`apps/api/src/jobs/`), started with the server and stopped cleanly on shutdown: stop taking jobs, finish or release the current ones, then exit.
- **When jobs slow down requests:** the same code and container image start in a second mode (`WORKER_ONLY=1`) as a separate worker service. No code changes.

**Watching it**

- queue depth and the age of the oldest job, per queue;
- failure and retry counts;
- an alert when a queue backs up or a job lands in the dead-letter queue;
- the platform console lists failed jobs per org;
- pg-boss archives finished jobs, and old ones are deleted after 14 days so the tables stay small.

**When to look beyond pg-boss:** many thousands of jobs a second, or event streaming between separate services. Neither is expected at this product's size (§1).

### 8.4 Backups and recovery

- The provider's PITR covers losing the database.
- Per-org exports cover restoring one customer without rolling back everyone else.
- **A restore drill on staging every quarter**, written up in `docs/`.

### 8.5 Observability

- **pino** structured logs: `requestId`, `orgId`, `userId`, route, duration, status. No personal data in logs.
- **Sentry** (or similar) for API and web errors, tagged with the error `ref` shown to users.
- `/health` (liveness) and `/ready` (database reachable, migrations current) for the host and an uptime monitor.
- A slow-query log (over 500 ms), and per-org request counts to spot an org that is overloading the system.

### 8.6 Platform administration

- An org list with status, users, last activity and plan.
- Create, suspend or reactivate an org; reset its admin.
- "View as" an org user, read-only by default, time-limited, recorded in the audit log, with a banner on the user's screen.
- Plans and limits (number of users, storage) as data on the org; billing (e.g. Razorpay subscriptions) comes later.

---

## 9. Testing and delivery

| Layer              | Tool                                       | What                                                                                                    |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Unit               | Vitest                                     | `packages/domain` (as today)                                                                            |
| Module integration | Vitest + PGlite or Testcontainers Postgres | each service: rows written, totals, audit entry, refused input, **RLS on**                              |
| Tenant isolation   | Vitest                                     | org A can't reach org B through any endpoint (§4), and gets 404, not 403 (§7.1); blocks merge           |
| API contract       | Fastify `inject()`                         | status codes, problem+json shape, permissions on every route; no internal `id`/`org_id` in any response |
| End to end         | Playwright (kept)                          | phone 390 and desktop 1440, English and Hindi, no-JS forms, multi-user booking; now also with two orgs  |
| Load               | k6                                         | 50 orgs × 15 users of realistic traffic against staging; p95 under 300 ms target                        |

**Continuous integration** (new; phase 1 has none):

- GitHub Actions runs typecheck, lint, unit, integration, isolation, build, and dependency-rule checks on every PR;
- e2e on merge to `main`;
- deploy order: migrate, then API, then web.

**Environments:**

- local: PGlite or Docker Postgres;
- **staging: Supabase plus a staging API**, with seeded demo orgs;
- production: managed Postgres.

Preview deployments per PR share the staging database, using a temporary org per preview.

---

## 10. Later, without redesign

| If this happens                                       | Add                                               | Already prepared by                   |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| A native driver app (offline, GPS)                    | Better Auth bearer plugin, offline sync endpoints | the API is the only door to the data  |
| A partner or customer API                             | per-org API keys, scoped permissions, webhooks    | OpenAPI contracts, permission catalog |
| One module needs to scale or be owned by its own team | extract it into a service                         | module boundaries checked in CI       |
| Live updates on the board                             | WebSockets or SSE from Fastify                    | single API process                    |
| Heavy reports                                         | read replica for `modules/reports`                | reports isolated in one module        |

---

## 11. Open decisions (to settle before building)

| #   | Decision                                                             | Recommendation                                                              |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Production Postgres provider                                         | AWS RDS `ap-south-1` if AWS is acceptable, otherwise DigitalOcean Bangalore |
| 2   | API host                                                             | container in Mumbai (Railway or Render to start, AWS later)                 |
| 3   | One domain (`/api` proxied) or subdomains                            | subdomains on the same site: `app.` and `api.`                              |
| 4   | Maximum sessions and what happens at the limit                       | per role, and sign out the oldest (§5.3)                                    |
| 5   | Invite link lifetime, and whether invites need admin approval        | 72 h, no approval                                                           |
| 6   | Self sign-up for new businesses, or platform-created only            | platform-created first                                                      |
| 7   | 2FA required for org admins?                                         | optional at first, required for platform admins                             |
| 8   | Notify admins about sign-ins from a new device                       | yes, in-app                                                                 |
| 9   | Can one person belong to several orgs (an accountant, a consultant)? | allow it in the data model, and add the org switcher later                  |
| 10  | Pricing per org or per user                                          | business decision; the data model supports both                             |
| 11  | Public ids: plain UUIDv7, or type-prefixed (`chl_…`)                 | plain UUIDv7 stored; prefix only in API output if support needs it          |

**Rejected options and why:**

- **Supabase Auth:** no login by name, no organisations, JWT revocation delay, and it ties production to Supabase.
- **Hand-made access/refresh tokens:** rotation, reuse detection and revocation all become ours, with no benefit for a cookie-based web app.
- **Schema or database per tenant:** N migrations and drift. Phase 1's practice schema already showed the cost.
- **BullMQ with Redis for jobs:** a second datastore to run, secure and back up, and jobs couldn't be added in the same transaction as the business write. pg-boss covers this product's job volume.
- **Microservices:** a team and load this size gains nothing.
- **NestJS:** more structure than one small team needs, so Fastify plus module rules is enough.

---

## 12. Order of work

Every step ships on its own, and the first client keeps working throughout as **org #1**.

| Step | Work                                                                                                                                                                                                                                                                  | Done when                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| M0   | Monorepo: move the app to `apps/web`; `packages/config`; Turborepo; GitHub Actions CI                                                                                                                                                                                 | phase-1 tests pass in CI, no behaviour change |
| M1   | Extract `packages/domain`, `packages/db`, `packages/contracts`                                                                                                                                                                                                        | same tests pass; web imports the packages     |
| M2   | Multi-tenancy: `organizations`, `org_id` everywhere (default org #1, backfilled), composite keys, `public_id` (UUIDv7) on every table and the web's URLs switched to it, per-org settings and numbering, RLS with the app role, demo orgs replace the practice schema | isolation tests pass                          |
| M3   | `apps/api` Fastify skeleton (auth stub, tenant plugin, error shape, logging, health); port modules one at a time, with the web switching each area to the API client (strangler)                                                                                      | `apps/web` has no `db` import left            |
| M4   | Better Auth: username, organization, admin, 2FA; migrate phase-1 users; invite links; sessions screens; policies; audit events                                                                                                                                        | session and invite tests, e2e sign-in flows   |
| M5   | Object storage for photos; pg-boss queue (transactional enqueue, retries, dead-letter queue, monitoring); exports as 202 jobs; per-org backups; reminders                                                                                                             | restore drill done on staging                 |
| M6   | Production Postgres: provision, migrate, copy org #1's data from Supabase, cut over in a short window                                                                                                                                                                 | old production kept read-only for 2 weeks     |
| M7   | Platform console, org onboarding, plans and limits, load test                                                                                                                                                                                                         | k6 targets met on staging                     |
