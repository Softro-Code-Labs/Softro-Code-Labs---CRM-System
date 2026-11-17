# Softro CRM

Internal customer relationship management system for **Softro Code Labs**.

**Using the CRM?** Read the [user guide](docs/USER-GUIDE.md).

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma 7 · Tailwind CSS 4 · Zod · jose (JWT sessions)

---

## Getting started (Windows / macOS / Linux)

**Requirements:** Node.js 20.9 or newer, and Docker Desktop (for PostgreSQL).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local env file from the template
#    Windows (PowerShell / CMD):  copy .env.example .env
#    macOS / Linux:               cp .env.example .env

# 3. Start PostgreSQL in Docker
npm run db:up

# 4. Create the database tables (first time: creates prisma/migrations/…_init)
npm run db:migrate -- --name init

# 5. Create the first admin user and the default sales pipeline
npm run db:seed

# 6. Run the app
npm run dev
```

Open http://localhost:3000 and sign in with the admin account from `.env`:

- Email: `admin@softrocodelabs.com`
- Password: `ChangeMe@123` (**change this before going live**)

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run lint` / `npm run typecheck` | Code quality checks |
| `pnpm test` | Unit tests (Vitest, a few seconds, no database needed) |
| `pnpm test:e2e` | Browser tests (Playwright) against a **test** database. See [Testing](#testing) |
| `pnpm check` | Lint + types + unit tests: run before pushing |
| `npm run db:migrate -- --name <change>` | Create and apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:seed` | Create the admin user and default pipeline (safe to re-run) |

> The project also has a `pnpm-lock.yaml`; with pnpm use `pnpm install`, `pnpm dev`, `pnpm db:migrate --name <change>` and so on.

---

## Project structure

```
prisma/
  schema.prisma        Full CRM data model
  seed.ts              Admin user + default IT-services sales pipeline
src/
  proxy.ts             Redirects signed-out visitors to /login (Next 16 "proxy", formerly middleware)
  app/
    login/             Sign-in page and login/logout server actions
    (app)/             Everything behind login, wrapped in the sidebar layout
      dashboard/
      companies/       List · search · filter · create · view · edit · delete
      contacts/        List · search · create · view · edit · delete
  components/
    layout/            Sidebar, top bar, navigation config
    ui/                Buttons, form fields, cards, badges, pagination…
  lib/
    auth.ts            Data Access Layer: current user + permission checks
    session.ts         Signed, httpOnly JWT session cookie
    permissions.ts     Role → permission map (one place for all access rules)
    audit.ts           Audit log writer
    db.ts              Prisma client (PostgreSQL driver adapter)
    validation/        Zod schemas for every form
    queries/           Reusable read queries
```

## Security model

- Passwords are hashed with bcrypt (cost 12). Login is protected against email-enumeration timing attacks.
- **Two-step sign-in (TOTP):** works with Google/Microsoft Authenticator, with 10 one-time recovery codes. Secrets are encrypted at rest (AES-256-GCM, key from `ENCRYPTION_KEY` or derived from `SESSION_SECRET`). Recovery codes are stored hashed, and each code or 30-second step works once. Admins can require it for admins and managers (Settings → Security) and reset it for someone who lost their phone.
- **Rate limits** are stored in Postgres so they hold across serverless instances: 20 sign-in attempts per 15 min per IP, 6 two-step codes per 10 min per user, 10 website enquiries per 10 min per visitor. Plus the per-account lock (5 wrong passwords = 15 min).
- Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie (and `Secure` in production), valid for 7 days. Changing a password, role or two-step setting signs that person out everywhere.
- `proxy.ts` blocks signed-out visitors from loading pages. **Every** page and server action also re-checks the user and their role through `src/lib/auth.ts`, so deactivating a user locks them out immediately.
- Roles: `ADMIN`, `MANAGER`, `SALES`, `SUPPORT`, `VIEWER`. The rules live in `src/lib/permissions.ts`.
- Every create, update, delete, login, logout and export is written to the `AuditLog` table.
- Headers (`next.config.ts`): Content-Security-Policy, HSTS (on Vercel), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and `Cross-Origin-Opener-Policy`. API responses are `no-store`.
- Configuration is checked at start-up (`src/instrumentation.ts`): the app refuses to start in production with a missing database URL or a short `SESSION_SECRET`.
- CSV exports neutralise spreadsheet formulas. Emails escape everything that came from a form. Team-chat webhooks are limited to Slack, Google Chat, Discord and Teams hosts.

## Testing

| Layer | Command | What it covers |
|---|---|---|
| Unit | `pnpm test` | TOTP (RFC 6238 vectors), encryption, recovery codes, working days and reply deadlines in Sri Lanka time, quote maths, SLA, permissions, report periods, CSV safety, email escaping, webhook allow-list, calendar line folding |
| Browser | `pnpm test:e2e` | Health and security headers, sign-in and account lock, viewer restrictions, two-step set-up / sign-in / recovery code, the company 2FA rule, lead → deal → won → report export, support tickets |

**Running the browser tests on your computer** (they create and change records, so use a separate database, **never** Neon production):

```powershell
docker compose up -d db                          # local Postgres from docker-compose.yml
docker compose exec db createdb -U softro softro_test   # first time only: a separate test database
$env:DATABASE_URL="postgresql://softro:softro_dev_password@localhost:5432/softro_test?schema=public"
pnpm db:deploy; pnpm db:seed                      # first time only
pnpm build
pnpm exec playwright install chromium             # first time only
pnpm test:e2e
```

The test accounts (`*@softro.test`) are created by `tests/e2e/global-setup.ts`, which refuses to run against a `neon.tech` address.

### CI/CD

- **`.github/workflows/ci.yml`** runs on every push to `main`/`dev` and every pull request: lint → types → unit tests → `pnpm audit` → build → browser tests against a throwaway Postgres 17. A failure report is attached to the run. In GitHub → Settings → Branches, add a rule for `main` (and `dev`) that requires the **CI** checks to pass before merging.
- **Vercel** deploys each push. `vercel.json` runs `scripts/vercel-build.mjs`, which applies database migrations (`prisma migrate deploy`) on **Production** deployments, then builds. If a migration fails, the deploy fails and the previous version stays live. Previews skip migrations unless `MIGRATE_ON_BUILD=true` is set for them (only do that when Preview has its own Neon branch).

## Monitoring

- **Settings → System health** (admins): database status, live version, configuration checks, and the **error log**. Every server error is recorded (`src/instrumentation.ts` → `src/lib/monitoring/errors.ts`), grouped by cause, and admins get at most one alert per error per hour (team chat, or email if chat isn't connected).
- **`GET /api/health`** returns `200 {"status":"ok"}` when the app and database work, `503` otherwise. Add it to a free uptime monitor (UptimeRobot or Better Stack) to be told when the CRM is down.
- Vercel → your project → **Logs** has the raw server logs, and **Cron Jobs** shows each morning-summary run.

## Backups and restore

1. **Neon** keeps a restore history for your database (how far back depends on your Neon plan). In the Neon console use **Restore** or create a branch from a past point in time. This is the quickest fix for "we deleted something this morning".
2. **Nightly encrypted copy** (`.github/workflows/backup.yml`, 02:00 Sri Lanka time, kept 30 days as a GitHub artifact). One-time setup in GitHub → Settings → Secrets and variables → Actions:
   - `BACKUP_DATABASE_URL`: Neon production **direct** connection string (host without `-pooler`).
   - `BACKUP_PASSPHRASE`: a long random passphrase. Keep it in the company password manager; without it the backups can't be opened.
   - Optional variable `PG_MAJOR` if your Neon database isn't Postgres 17.
   Run it once by hand (Actions → Database backup → Run workflow) to check it works.

**To restore a nightly backup** (into a **new Neon branch** first, never straight over production):

```bash
gpg --decrypt softro-crm_2026-11-18_0200.dump.gpg > crm.dump      # asks for BACKUP_PASSPHRASE
pg_restore --no-owner --no-acl --dbname="<new branch connection string>" crm.dump
```

Check the data in the new branch (point a local copy of the CRM at it). Then either make that branch the production database in Neon, or copy back just what was lost. This exact procedure is tested: dump → encrypt → decrypt → restore gives identical row counts.

## Updating your database after pulling new code

When `prisma/schema.prisma` changes (as in Step 2), create and apply a migration, then re-run the seed:

```bash
pnpm db:migrate --name leads_and_deals   # or: npm run db:migrate -- --name leads_and_deals
pnpm db:seed                              # updates the pipeline stages if no deals exist yet
```

## Sales pipeline (Step 2)

- **Leads** are new enquiries. Each one gets a **reply-by deadline 2 working days** after it arrives (Mon–Fri, Sri Lanka time; public holidays are not counted yet). Overdue leads are flagged in red on the dashboard and in **Leads → Needs reply**.
- Moving a lead past *New*, or clicking **Mark as replied**, records the reply.
- **Convert to deal** creates the deal and can also create the client company and contact in one step.
- **Deals** move through the *Softro Projects* pipeline: Discovery call → Proposal & quote → Design approval → Won / Lost. Drag cards on the board (or use the stage bar on a deal). Winning a deal turns a prospect company into a customer.
- Totals are shown per currency (LKR, USD, …). Different currencies are never added together.

## Website form → CRM

`POST /api/leads` creates a lead from the "Start your project" form on softrocodelabs.com.

1. Set `WEBSITE_LEAD_API_KEY` (and optionally `WEBSITE_LEAD_OWNER_EMAIL`) in the CRM's `.env`.
2. In the **website's server code** (a Next.js route handler or server action, never in browser JavaScript), forward the form:

```ts
await fetch(`${process.env.CRM_URL}/api/leads`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.CRM_LEAD_API_KEY!,      // same value as WEBSITE_LEAD_API_KEY
    "x-visitor-ip": visitorIp,                        // optional, used for rate limiting
  },
  body: JSON.stringify({
    name: "Saman Kumara",
    contact: "077 123 4567",            // "Email or WhatsApp number"
    service: "Business system",         // the option they picked on the form
    message: "We need a POS for our hardware shop…",
    language: "si",                     // "en" or "si" (Sinhala page)
    website: "",                        // the hidden "Company website" honeypot field
  }),
});
```

Responses: `201` created · `401` wrong key · `422` invalid data · `429` too many submissions.

## Integrations (Step 8)

Set these in Vercel (Production only, see [Deploying](#deploying)) and in `.env` locally, then redeploy:

| Variable | What it's for |
|---|---|
| `APP_URL` | Public address of the CRM, e.g. `https://crm.softrocodelabs.com`. Used for links in emails and calendar events. |
| `RESEND_API_KEY` | Resend API key with sending access (same account as the website). |
| `EMAIL_FROM` | Sender, on a domain verified in Resend, e.g. `Softro CRM <crm@softrocodelabs.com>`. |
| `CRON_SECRET` | Random text, 16+ characters. Vercel sends it to `/api/cron/daily-digest` (schedule in `vercel.json`: 02:30 UTC = 8:00 am Sri Lanka, Mon–Fri). |

The team chat webhook is set in the app (**Settings → Integrations**), not in env vars. Without `RESEND_API_KEY` emails are skipped and logged, so local development works without an account.

## Deploying

### Vercel + Neon (what we use)

1. In Vercel → Settings → **Environment Variables**, add the variables from the table below. After any change, **redeploy**.
2. Database changes are applied **automatically** on Production deploys (see [CI/CD](#cicd)). To apply them by hand: `$env:DATABASE_URL="<neon url>"; pnpm db:deploy`.
3. First time only: run `pnpm db:seed` from your computer (it reads `SEED_ADMIN_*` from your local `.env`), then sign in and change the admin password.
4. The 8 am summary runs on Vercel Cron from `vercel.json`. It only runs on **Production** deployments.

| Variable | Production | Preview | Sensitive | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ main Neon database | ✅ a **separate** Neon branch (e.g. `preview`) | ✅ | Never point previews at the real data. |
| `SESSION_SECRET` | ✅ | ✅ **different** value | ✅ | 48+ random characters. Changing it signs everyone out. |
| `DIRECT_URL` | ✅ Neon **direct** URL (no `-pooler`) | only with its own branch | ✅ | Optional. Used for migrations; falls back to `DATABASE_URL`. |
| `ENCRYPTION_KEY` | ✅ | ✅ different value | ✅ | Optional, 32+ characters. Encrypts two-step sign-in secrets. Set once and never change it (people would have to set 2FA up again). Without it, it's derived from `SESSION_SECRET`. |
| `MIGRATE_ON_BUILD` | — | `true` only if Preview has its own Neon branch | — | Lets preview builds run migrations on their own database. |
| `DEFAULT_CURRENCY` | ✅ `LKR` | ✅ `LKR` | — | |
| `APP_URL` | ✅ `https://crm.softrocodelabs.com` | — | — | Links in emails and calendar events. |
| `WEBSITE_LEAD_API_KEY` | ✅ | — | ✅ | Same value in the website project. 24+ characters. |
| `WEBSITE_LEAD_OWNER_EMAIL` | ✅ | — | — | A CRM user's email, e.g. `admin@softrocodelabs.com`. |
| `RESEND_API_KEY` | ✅ | — | ✅ | Its **own** key (not the website's): Sending access, softrocodelabs.com only. |
| `EMAIL_FROM` | ✅ | — | — | `Softro CRM <crm@softrocodelabs.com>` |
| `CRON_SECRET` | ✅ | — | ✅ | 16+ random characters. |
| `SEED_ADMIN_*` | — | — | — | Local `.env` only. Don't add to Vercel. |

- **Why previews get less:** a preview build must not change real clients and deals, email the team, or receive website enquiries. Without `RESEND_API_KEY` the CRM skips emails, so previews are safe.
- **Sensitive values** can't be viewed again in Vercel after saving, only replaced. Keep a copy in the company password manager.
- **Nothing is needed in Vercel's Development environment.** Your computer uses `.env` (copy `.env.example`).
- Generate random values with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

### Other hosting (VPS or Docker)

1. Set the same variables as Production above on the server.
2. Run `pnpm db:deploy`, then `pnpm db:seed` once.
3. Either `pnpm build && pnpm start`, or build the included `Dockerfile` (standalone output, runs as a non-root user).
4. Put it behind HTTPS (Nginx or Caddy). Call `/api/cron/daily-digest` at 02:30 UTC on weekdays with the header `Authorization: Bearer $CRON_SECRET` (e.g. from cron with curl).

---

## Roadmap

| Step | Scope | Status |
|---|---|---|
| **1. Foundation** | Project setup, data model, auth & roles, app layout, dashboard, Companies, Contacts, audit log | ✅ Done |
| **2. Sales pipeline** | Leads (WhatsApp, website form, referrals…) with a 2-working-day reply tracker · convert lead → deal · drag-and-drop deals board · won/lost tracking · website form API | ✅ Done |
| **3. Activities & notes** | Notes · log calls, WhatsApp, emails and meetings · scheduled tasks with due dates and owners · timeline on every record · Activities page (overdue/today/upcoming/done) · dashboard "My tasks" | ✅ Done |
| **4. Team & settings** | Team members (add with temporary password, roles, reset, deactivate) · forced password change · login lockout · sign-out-everywhere on reset/role change · My profile · pipeline stage editor · audit log viewer | ✅ Done |
| **5. Quotes & proposals** | Services & prices catalogue · quotes with line items, discounts and tax · numbered Q-YYYY-NNNN · draft/sent/accepted/declined · branded PDF (Geist + Softro logo) · accepted quote updates deal value · company details & bank info | ✅ Done |
| **6. Contracts & support** | Maintenance / hosting / retainer contracts numbered C-YYYY-NNNN · renewal tasks before the end date · one-click renew, pause, cancel · monthly recurring value · support tickets T-YYYY-NNNN with first-reply SLA, replies & internal notes, status and assignee · company, deal and dashboard cards | ✅ Done |
| **7. Reports & dashboard** | Reports page with period & person filters · won revenue by month · win rate, average deal, time to win · revenue by service & client · lost reasons · 6-month weighted pipeline forecast · lead sources & reply times · team performance · support SLA & recurring revenue · CSV export (audited) | ✅ Done |
| **8. Integrations** | Email via Resend (assignment emails, new website enquiry alerts with reply-to) · 8 am morning summary (Vercel Cron) · team chat alerts (Slack, Google Chat, Discord, Teams) · private calendar feed for Google Calendar/Outlook · accepted-quotes accounting export · Settings → Integrations with test buttons | ✅ Done |
| **9. Hardening** | Two-step sign-in (authenticator app + recovery codes, admin reset, required for admins/managers) · DB-backed rate limits · CSP/HSTS headers · start-up config checks · built-in error log with alerts + `/api/health` · Settings → Security and System health · 33 unit + 13 browser tests · GitHub Actions CI · migrations on deploy · nightly encrypted backups with tested restore | ✅ Done |
