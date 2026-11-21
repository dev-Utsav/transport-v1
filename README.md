# Transport Desk

Trips, challans (LR / bilty), parties and their ledgers, payments, expenses, salary, GST and reports for a single transport office in Kadodara. One admin, phone first, Hindi and English.

## Run locally

```bash
pnpm install
cp .env.example .env.local      # set APP_PASSWORD (leave DATABASE_URL empty)
SEED_DEMO=1 pnpm dev            # demo data on first start; plain `pnpm dev` for an empty desk
```

The local database lives in `.data/` (delete the folder to start over).

## Deploy (Vercel + Supabase, Mumbai)

1. Create a Supabase project in `ap-south-1` and copy the **Session pooler** connection string.
2. `DATABASE_URL=… pnpm db:migrate`
3. On Vercel, set `APP_PASSWORD`, `DATABASE_URL` and `CRON_SECRET` (16+ characters). The region (`bom1`) and the nightly backup cron are set in `vercel.json`.

Rules for working on the code: `CLAUDE.md`. State and open points: `docs/PROGRESS.md`.
