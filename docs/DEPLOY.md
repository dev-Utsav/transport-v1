# Deploying Transport Desk: staging, then production

One Vercel project, two environments, two databases:

|                | Vercel environment                  | Database                                           | Data                                      |
| -------------- | ----------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| **Staging**    | Preview (`vercel deploy`)           | Supabase project `transport-desk-staging` (Mumbai) | sample data + demo logins (`SEED_DEMO=1`) |
| **Production** | Production (`vercel deploy --prod`) | Supabase project `transport-desk-prod` (Mumbai)    | real; first admin made with the setup key |

Secrets never go in chat, git or the shell history: they are typed into Vercel's own prompts and pulled into git-ignored `.env.*.local` files when a local command needs them.

## 0. Before you start

- **Vercel plan:** Hobby is for non-commercial use only. A client's business tool needs **Pro**. Hobby also limits crons to one a day; the nightly backup is one a day, so it fits either way.
- `pnpm check` and `pnpm test:e2e` pass on the branch being deployed.

## 1. Accounts (the person who owns them does this)

1. **Supabase:** create two projects, both in **South Asia (Mumbai)**, each with a long generated database password: `transport-desk-staging` and `transport-desk-prod`.
2. In each project: **Connect → Session pooler** (port 5432, user `postgres.<project-ref>`, host `aws-…-<region>.pooler.supabase.com`). **Not the direct connection** (`db.<ref>.supabase.co`): that one is IPv6-only and Vercel can't reach it. Keep the string for step 3. Don't paste it here.
3. In each project: **Project Settings → Data API → turn the Data API off.** The app talks to Postgres directly and never uses it. Migration `0001_enable_rls` also switches row level security on for every table, as a second lock.
4. **Vercel:** in this folder, run `! npx vercel login`, then `! npx vercel link` (create a new project, "transport-desk"). Region `bom1` comes from `vercel.json`.

## 2. Environment variables

Generate the two secrets straight into Vercel (they never appear on screen):

```sh
for env in preview production; do
  node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" | npx vercel env add SESSION_SECRET $env
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | npx vercel env add CRON_SECRET $env
done
printf 1 | npx vercel env add SEED_DEMO preview
```

Type these at Vercel's prompt (`! npx vercel env add NAME ENV`):

| Name           | preview (staging)                                          | production                                      |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL` | staging session pooler URL                                 | prod session pooler URL                         |
| `APP_PASSWORD` | the staging demo password (also the demo logins' password) | the one-time setup key, given to the owner only |

## 3. Staging

```sh
npx vercel env pull .env.staging.local --environment=preview   # git-ignored
bash scripts/migrate.sh .env.staging.local                      # tables + RLS (safe to repeat)
npx vercel deploy                                               # prints the staging URL
```

The first request seeds the sample data and the demo logins (admin, neha, ramesh, kishan).

**Test staging** (Vercel → Settings → Deployment Protection → _Protection Bypass for Automation_ gives the bypass secret):

```sh
E2E_BASE_URL=https://<staging-url> E2E_PASSWORD=<staging APP_PASSWORD> VERCEL_BYPASS=<secret> \
  pnpm exec playwright test
```

This runs every screen in English and Hindi at 390 and 1440, the role limits, booking with JS off, and **six devices booking at the same moment** (`multi-user.spec.ts`) against real Postgres through the pooler.

By hand on a phone: sign in as each demo login; book → load → leave → arrive → deliver with To-Pay → payment; a bill photo; print and WhatsApp; Hindi.

**Check the database lock** (Supabase → SQL editor). It must return no rows:

```sql
select relname from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
```

## 4. Production (only after staging passes)

### Automatic: every push to `main` (`.github/workflows/production.yml`)

Merging a pull request into `main` runs **build → migrate → deploy**:

1. `vercel pull` (production settings, including `DATABASE_URL`) and `vercel build --prod`. A broken build stops here and the database is never touched.
2. `scripts/migrate.sh` against the production database:
   - **idempotent**: migrations already applied are skipped; with nothing new it only prints "Database is up to date";
   - **one run at a time**: an advisory lock makes a second deploy wait (up to 5 min);
   - **refuses and changes nothing** if an applied migration file was edited, the database has a migration this code lacks (older code), or a new migration is dated before the last applied one (`scripts/migrate-plan.ts`, unit tested). Line endings don't count as edits;
   - `lock_timeout 15s`: a migration stuck behind live traffic fails and rolls back instead of blocking the site; all pending migrations run in one transaction.
3. `vercel deploy --prebuilt --prod` of that same build, only if the migration succeeded.

Runs queue in order (never cancelled mid-migration). Vercel's own Git deploys of `main` are off (`vercel.json` → `git.deploymentEnabled`), so this workflow is the only path to production; other branches still get previews. **Migrations must be additive** (new tables/columns, backfills): the old deployment keeps serving between step 2 and 3.

**One-time setup** (GitHub → repository → Settings → Secrets and variables → Actions → New repository secret, or `! gh secret set NAME`):

| Secret              | Value                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Vercel → Account Settings → Tokens → create, scoped to the project's team                 |
| `VERCEL_ORG_ID`     | `orgId` in `.vercel/project.json` (after `npx vercel link` to the **production** project) |
| `VERCEL_PROJECT_ID` | `projectId` in the same file                                                              |

`DATABASE_URL` is read from Vercel's production environment, not stored in GitHub. If it is marked **Sensitive** in Vercel, `vercel pull` can't read it and the migrate step stops with "DATABASE_URL is not set": un-mark it, or tell the developer to switch the step to a GitHub secret.

Optional: GitHub → Settings → Environments → `production` → required reviewers, so each production deploy waits for a click.

### By hand (first deploy, or if GitHub Actions is down)

```sh
npx vercel env pull .env.production.local --environment=production
bash scripts/migrate.sh .env.production.local
npx vercel deploy --prod
```

### After the first deploy

1. Open the site. The owner signs in with the setup key and creates their admin login. The key does nothing after that.
2. Settings → Users: one login per person (5–6), each with their role. A driver login links to the driver in Staff. Everyone changes their first password at first sign-in.
3. Run the backup once by hand and check it appears under Settings → Backup:
   `curl -H "Authorization: Bearer <CRON_SECRET>" https://<prod-url>/api/cron/backup`
4. Delete `.env.production.local` from this computer.

## 5. If something goes wrong

- **Bad deploy:** `npx vercel rollback` returns to the previous deployment at once (the database is untouched).
- **A save fails:** the person sees "Couldn't save … Reference: ab12cd34". Search the Vercel logs (Project → Logs) for `ref=ab12cd34` to find the real error.
- **Backups:** the nightly backups live **in the same database**. They protect against mistakes, not against losing the database. Download one from Settings → Backup every week and keep it off-site, or move to Supabase Pro for its daily backups.
