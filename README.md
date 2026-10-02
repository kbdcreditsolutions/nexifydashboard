# Nexify Operations & Finance Dashboard

Internal operations and finance management system for Nexify InfoSystems. Connects
Employees → Hours → Clients → Projects → Revenue → Expenses → Profit → Cash Flow
in one normalized data model — every number on the dashboard is derived live from
underlying records, not manually entered.

**Live:** https://nexify-dashboard.vercel.app

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Prisma 6** + **Postgres** (Neon, provisioned via the Vercel marketplace
  integration) — serverless functions have an ephemeral filesystem, so
  production can't use file-based SQLite
- **NextAuth v5** (Credentials) with role-based access control
  (Owner / Finance / Operations / Manager / Employee)
- **Tailwind v4 + shadcn/ui (Radix)** for the UI, **Recharts** for charts,
  **TanStack Table v8** for data tables

## Getting started

Local dev and production share the same Neon Postgres database (`vercel env pull`
below fetches its connection string) — there's no separate local-only database.

```bash
npm install
vercel link                           # one-time: link this checkout to the Vercel project
vercel env pull .env                  # pulls DATABASE_URL / DATABASE_URL_UNPOOLED / NEXTAUTH_SECRET
npm run db:reset                      # pushes the schema, seeds demo data (~3 min over the network)
npm run dev
```

If you're not using Vercel, copy `.env.example` to `.env` instead and point
`DATABASE_URL` / `DATABASE_URL_UNPOOLED` at your own Postgres instance.

Open http://localhost:3000 and sign in with one of the seeded demo accounts
(password `Nexify2026!` for all):

| Role | Email |
|---|---|
| Owner | owner@nexifyinfo.com |
| Finance | finance@nexifyinfo.com |
| Operations | ops@nexifyinfo.com |
| Manager | manager@nexifyinfo.com |
| Employee | employee@nexifyinfo.com |

## Deployment

Deployed on Vercel, connected to the `main` branch of this repo (push to `main`
auto-deploys). Database: Neon Postgres, installed as a Vercel marketplace
integration and connected to the project — `DATABASE_URL`/`DATABASE_URL_UNPOOLED`
are already set as Vercel env vars for Production/Preview/Development.

```bash
vercel deploy --prod        # manual deploy, if you don't want to wait on the git push
npm run db:seed             # reseed the connected database (local and prod share it)
```

`NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set directly as Vercel env vars (not
pulled from Neon) — rotate `NEXTAUTH_SECRET` with `openssl rand -base64 32` if
you ever need to invalidate all sessions.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and server
- `npm run lint` — ESLint
- `npm run db:seed` — re-run the seed script against the current database
  (batched inserts — ~3 min against Neon, seconds against a local Postgres)
- `npm run db:reset` — drop and recreate the schema, then reseed

## Architecture notes

- `prisma/schema.prisma` — the full data model (employees, clients, projects,
  timesheets, revenue, invoices, payments, expenses, payables, cash transactions,
  settings, audit log). `directUrl` carries the unpooled connection Prisma needs
  for schema push/migrations; `url` is the pooled connection the app uses at runtime.
- `src/lib/calc.ts` — the calculation engine. Employee/client/project economics,
  company P&L, AR aging, AP summary, cash flow and 30/60/90-day forecast all live
  here and query Prisma directly; UI pages never compute financial figures inline.
- `src/lib/alerts.ts` — alerts (overdue invoices, budget overruns, low utilization,
  expense spikes, upcoming payables, low cash, expiring contracts) are computed
  live against thresholds configurable in Settings, not stored as stale rows.
- `src/lib/rbac.ts` — permission checks, enforced both in page components
  (server-side redirect for unauthorized roles) and in server actions (every
  mutation re-checks the session role, independent of what the UI shows).
- Financial records are append-only where it matters: payments accumulate against
  invoices rather than overwriting a balance, and every create/update/approve
  action writes an `AuditLog` row.
- `public/brand/` — logo assets pulled from nexifyinfosystems.com; `src/app/icon.png`
  is the browser-tab icon (Next's `icon.png` file convention).
