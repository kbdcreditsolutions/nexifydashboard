# Nexify Operations & Finance Dashboard

Internal operations and finance management system for Nexify InfoSystems. Connects
Employees → Hours → Clients → Projects → Revenue → Expenses → Profit → Cash Flow
in one normalized data model — every number on the dashboard is derived live from
underlying records, not manually entered.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Prisma 6** + SQLite for local dev (schema is Postgres-portable — swap the
  datasource `provider` and `DATABASE_URL` for production, no model changes needed)
- **NextAuth v5** (Credentials) with role-based access control
  (Owner / Finance / Operations / Manager / Employee)
- **Tailwind v4 + shadcn/ui (Radix)** for the UI, **Recharts** for charts,
  **TanStack Table v8** for data tables

## Getting started

```bash
npm install
cp .env.example .env        # set NEXTAUTH_SECRET to a random 32+ char string
npm run db:reset            # creates the SQLite db, pushes the schema, seeds demo data
npm run dev
```

Open http://localhost:3000 and sign in with one of the seeded demo accounts
(password `Nexify2026!` for all):

| Role | Email |
|---|---|
| Owner | owner@nexifyinfo.com |
| Finance | finance@nexifyinfo.com |
| Operations | ops@nexifyinfo.com |
| Manager | manager@nexifyinfo.com |
| Employee | employee@nexifyinfo.com |

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and server
- `npm run lint` — ESLint
- `npm run db:seed` — re-run the seed script against the current database
- `npm run db:reset` — drop and recreate the schema, then reseed

## Architecture notes

- `prisma/schema.prisma` — the full data model (employees, clients, projects,
  timesheets, revenue, invoices, payments, expenses, payables, cash transactions,
  settings, audit log).
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
>>>>>>> origin/main
