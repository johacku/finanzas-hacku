# Local DB Setup — hacku-app

This guide explains how to run a local Supabase instance for development so you can work against a local database instead of production.

## Prerequisites

- **Docker Desktop** (or OrbStack) running — Supabase CLI requires Docker.
- **Supabase CLI** ≥ 1.x installed (`brew install supabase/tap/supabase` or `npm i -g supabase`).
- **psql** for applying the baseline dump (comes with PostgreSQL: `brew install postgresql@15`).
- **Node 18+** for the Next.js dev server.

## 1 — Start Supabase locally

```bash
supabase start
```

This pulls Docker images and starts all services (Postgres on 54322, API/PostgREST on 54321, Studio on 54323, Inbucket on 54324).

When it finishes it prints something like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Anon key: eyJ...
Service role key: eyJ...
```

Copy those values — you'll need them in `.env.local`.

## 2 — Apply the schema baseline

The baseline SQL was generated from production and lives in `supabase/baseline/000_schema_baseline.sql`. Apply it to the local DB:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/baseline/000_schema_baseline.sql
```

> **Do not** put baseline files in `supabase/migrations/` — that folder is for incremental migration files tracked in git. The baseline is a one-time snapshot.

## 3 — Seed synthetic data

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed.sql
```

This inserts 2 vendedores, 2 hacku_clientes, 2 planes, TRM rates for today, and a demo income invoice.

## 4 — Create a local auth user

Open Supabase Studio at http://127.0.0.1:54323, go to **Authentication → Users**, and create a user with your email + any password. Alternatively use the CLI:

```bash
supabase auth admin create-user \
  --email dev@hacku.co \
  --password password123 \
  --role authenticated
```

## 5 — Configure .env.local

Create `.env.local` in the project root (it is gitignored):

```dotenv
# ── Supabase local ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase start output>

# ── OpenAI (PDF extraction) ─────────────────────────────────────
OPENAI_API_KEY=sk-proj-YOUR_REAL_KEY

# ── Alegra (fake for local — real creds not needed unless testing invoicing) ──
ALEGRA_API_EMAIL=test@example.com
ALEGRA_API_TOKEN=fake-token-local

# ── Stripe (use test mode key from Stripe Dashboard) ───────────
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_TEST_KEY

# ── Slack (disable locally — bot won't send messages) ──────────
SLACK_BOT_TOKEN=xoxb-fake-local-token

# ── Google Sheets webhook (disable locally) ────────────────────
GOOGLE_SHEETS_INCOME_SEGMENTATION_URL=http://localhost/disabled

# ── Cron secret (any string for local testing) ─────────────────
CRON_SECRET=local-dev-secret-123
```

## 6 — Run the app

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Use the credentials you created in step 4.

## Refreshing the baseline

When a new migration is applied to production, regenerate the baseline:

```bash
supabase db dump --linked -f supabase/baseline/000_schema_baseline.sql
```

Then repeat steps 2–3 after a `supabase db reset` (which wipes and restarts the local DB):

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/baseline/000_schema_baseline.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed.sql
```

## Stopping the local instance

```bash
supabase stop
```

Add `--no-backup` to skip saving local DB state between sessions.
