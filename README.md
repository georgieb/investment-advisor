# Investment Advisor

A private portfolio analysis app. Users sign up, answer a short risk questionnaire about their finances, retirement plans and comfort with risk, then enter their holdings. The app works out their risk level, compares their portfolio against a target allocation for that level, and suggests concrete moves: rebalancing, concentration warnings, emergency-fund and retirement-savings gaps.

> For educational purposes only. The app does not provide personalized investment, tax or legal advice.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) + Tailwind CSS 4
- **Supabase**: Postgres, Auth (email + password with email confirmation), Row Level Security
- **Zod** for input validation, **Vitest** for tests

## Roadmap

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | Auth, risk profile questionnaire, manual accounts and holdings, portfolio analysis and suggested moves | ✅ This release |
| 2 | Brokerage connections (Charles Schwab / thinkorswim) that sync accounts and positions automatically; live prices | Planned: see `src/lib/brokers/types.ts` |
| 3 | Customizable dashboard: categorize investments, track performance over time, charts | Planned |

## Security and privacy model

Holdings are the most sensitive data in the app. They are protected at several layers:

1. **Database (the real boundary).** Every user table has Row Level Security. Policies only let the `authenticated` role read or write rows where `user_id = auth.uid()`. The `anon` role has no table privileges at all. Holdings reference accounts through a composite `(account_id, user_id)` foreign key, so a holding can't be attached to someone else's account even through a crafted request. See `supabase/migrations/`.
2. **Server.** All data access happens in Server Components and Server Actions through `src/lib/dal.ts`, which verifies the session JWT with `supabase.auth.getClaims()` (signature and expiry, not just cookie contents). Each action re-checks the user and validates input with Zod. The service-role key is never used, so even a server bug can't bypass RLS.
3. **Transport and caching.** Pages with financial data send `Cache-Control: private, no-store`, and per-user data is never put in Next's `use cache`. Standard security headers (HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy) are set in `next.config.ts`.
4. **No third parties.** No analytics, ads or tracking scripts, and no data is shared or sold. Future broker integrations will request read-only scopes and store OAuth tokens encrypted in Supabase Vault, server-side only.
5. **Auth.** Email confirmation is required. Passwords must be 12+ characters with upper and lowercase letters and a number. Login errors don't reveal whether an email is registered. Post-login redirects only allow same-site paths.

`tests/rls.test.ts` runs the real migration in an embedded Postgres and checks that users can't read, create, update, delete or reassign each other's data, and that anonymous requests are denied.

## Getting started

Requirements: Node 20.9+ and, for the local database, Docker.

```bash
npm install
cp .env.example .env.local
```

### Option A: local Supabase (recommended for development)

```bash
npm run db:start      # starts Postgres, Auth and a mail catcher; applies migrations
```

Copy the printed `API_URL` and `PUBLISHABLE_KEY` into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then:

```bash
npm run dev           # http://127.0.0.1:3000
```

Confirmation emails go to the local mail catcher at http://127.0.0.1:54324.

### Option B: a hosted Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Or paste `supabase/migrations/*.sql` into the SQL editor.
3. Put the project URL and **publishable** key (Project Settings → API) in `.env.local`.
4. In **Authentication → URL Configuration**, set the Site URL to your app's URL and add `https://<your-domain>/auth/confirm` to the redirect URLs.
5. In **Authentication → Providers → Email**, keep "Confirm email" on, set the minimum password length to 12, and turn on leaked password protection.
6. Before launch, configure a custom SMTP server. Supabase's built-in email is rate-limited and intended for testing.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests and RLS security tests (no Docker needed) |
| `npm run test:e2e` | Browser smoke test against a running app and local Supabase |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:start` / `db:stop` / `db:reset` | Manage the local Supabase stack |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local database |

## How the analysis works

**Risk level** (`src/lib/risk/questionnaire.ts`). Two 0–100 scores:

- **Capacity**: how much risk the user's situation can absorb. Based on years to retirement, when the money is needed, emergency savings and income stability. Capped low if the money is needed within 3 years.
- **Tolerance**: how much risk they're comfortable with. Based on their reaction to a 25% drop, a gain/loss trade-off question, their goal and their experience.

The overall score is the **lower** of the two, mapped to one of five levels from Conservative to Aggressive.

**Portfolio analysis** (`src/lib/portfolio/analysis.ts`). Holdings are grouped into US stocks, international stocks, bonds, cash and alternatives, then compared with the target allocation for the user's level. Suggestions:

- Rebalance any bucket that drifts 5+ percentage points, with a dollar amount.
- Flag single positions over 10% of the portfolio. Common broad index funds are exempt.
- Build an emergency fund first if it covers less than 3 months.
- Close retirement savings gaps: projects savings in today's dollars at a conservative real return per risk level and shows the extra monthly saving needed.

## Project layout

```
supabase/migrations/      Database schema and RLS policies
supabase/config.toml      Local Supabase config (auth hardening included)
src/proxy.ts              Session refresh and route protection (Next 16's "middleware")
src/lib/dal.ts            Verifies the current user. Every read and write goes through it
src/lib/data.ts           Per-user queries (RLS-scoped, never cached)
src/lib/risk/             Questionnaire and risk scoring
src/lib/portfolio/        Allocation analysis, targets, suggestions, form schemas
src/lib/brokers/          Interface for future brokerage integrations
src/app/(auth)/           Sign in / sign up
src/app/(app)/            Dashboard, holdings, risk profile (signed-in only)
src/app/auth/confirm/     Email confirmation landing route
tests/rls.test.ts         Row Level Security tests
e2e/smoke.mjs             End-to-end browser test
```
