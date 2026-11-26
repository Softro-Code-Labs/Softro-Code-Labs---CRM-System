# Softro CRM 🧭

Softro Code Labs' own CRM: **leads, deals, quotes, invoices, contracts, support and reports in one place**, built for how we sell and support software in Sri Lanka.

Live at **[softro-code-labs-crm-system.vercel.app](https://softro-code-labs-crm-system.vercel.app)**, moving to **crm.softrocodelabs.com** (team members only)

> New here? Start with **[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)**. It explains the whole project in plain words.
> Using the CRM day to day? Read the **[user guide](docs/USER-GUIDE.md)**. Admins fixing a numbering or test-data mistake: **[database fixes](docs/DATABASE-FIXES.md)**.

**Built with:** Next.js 16 · React 19 · TypeScript · PostgreSQL (Neon) · Prisma 7 · Tailwind CSS v4 · Zod · jose · React-PDF · Resend · Vitest · Playwright · Vercel

---

## Get it running

You need **Node.js 20.9+**, **pnpm** and **Docker Desktop** (for the local database).

```bash
pnpm install                 # also generates the Prisma client
copy .env.example .env       # macOS/Linux: cp .env.example .env
pnpm db:up                   # start PostgreSQL in Docker
pnpm db:deploy               # create the tables
pnpm db:seed                 # first admin + the "Softro Projects" pipeline (safe to re-run)
pnpm dev                     # http://localhost:3000
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env` (`admin@softrocodelabs.com` / `ChangeMe@123` by default). You'll be asked to choose a new password. Never commit `.env` files.

| Command | What it does |
|---|---|
| `pnpm dev` | Start the CRM locally |
| `pnpm build` / `pnpm start` | Make and run a production build |
| `pnpm check` | Lint + type-check + unit tests. Run it before pushing |
| `pnpm test` | Unit tests (Vitest, a few seconds, no database needed) |
| `pnpm test:e2e` | Browser tests (Playwright) against a **test** database. See [Tests](#tests) |
| `pnpm db:migrate --name <change>` | After editing `prisma/schema.prisma`: create and apply a migration |
| `pnpm db:deploy` | Apply migrations that haven't run yet |
| `pnpm db:studio` | Browse the database in Prisma Studio |

## Where things live

| I want to… | Look in |
|---|---|
| Change the data model (a new field or table) | `prisma/schema.prisma`, then `pnpm db:migrate --name <change>` |
| Change a screen (list, detail, form) | `src/app/(app)/<area>/` (`leads`, `deals`, `quotes`, `contracts`, `support`, `reports`, `settings`…) |
| Change what happens when someone saves | `actions.ts` next to that screen (server actions) |
| Change who can do what | `src/lib/permissions.ts` (one map for every role) |
| Change who **sees** which leads, deals, quotes, invoices, companies, contacts, contracts, activities and project access (own / team / all), the New web leads board, or who can be made owner | `src/lib/visibility.ts`; teams are `User.managerId`, set in `src/app/(app)/settings/users/` |
| Change form rules and error messages | `src/lib/validation/` |
| Change labels, colours of statuses, dropdown options | `src/lib/crm-meta.ts` |
| Change the sidebar | `src/components/layout/nav-items.ts` |
| Change buttons, fields, cards, badges | `src/components/ui/` |
| Change the quote PDF | `src/lib/pdf/quote-pdf.tsx`, fonts in `src/assets/fonts/` |
| Change the invoice or receipt PDF | `src/lib/pdf/invoice-pdf.tsx`, `src/lib/pdf/receipt-pdf.tsx`; amount in words in `src/lib/amount-in-words.ts` |
| Change the company seal artwork | `scripts/make-seal.cjs`, then `node scripts/make-seal.cjs` (writes `src/lib/seal-artwork.ts`). Never edit the generated file by hand |
| Change sealing (who, when, what locks) or signatures | `src/app/(app)/seal-actions.ts`, `src/lib/seal.ts`, PDF parts in `src/lib/pdf/shared.tsx`; signature clean-up in `src/lib/signature.ts`, upload in `src/app/(app)/settings/profile/signature-*.ts(x)` |
| Change invoicing rules (advance/balance, payments, follow-up task) | `src/lib/invoices.ts`, `src/app/(app)/invoices/actions.ts` |
| Change quote maths (discounts, VAT) | `src/lib/quote-math.ts` |
| Change reply deadlines and working days | `src/lib/working-days.ts`, ticket times in `src/lib/tickets.ts` |
| Change report figures | `src/lib/reports.ts`, CSV exports in `src/app/(app)/reports/export/route.ts` |
| Change commission, the tax estimate or tax-year periods | Maths in `src/lib/finance-math.ts` (unit-tested), commission on payments in `src/lib/commissions.ts`, page figures in `src/lib/finance.ts`, accountant CSV in `src/app/(app)/finance/export/route.ts`; rates in Settings → Commission & tax |
| Change My team (team list, member page, hand over work) | `src/app/(app)/team/`, workload counts in `src/lib/team.ts` |
| Change the warranty and NDA (starting wording, fields, periods) | `src/lib/delivery-docs.ts`; admins edit them in `src/app/(app)/settings/documents/`; printed as extra pages by `src/lib/pdf/handover-pdf.tsx` |
| Change project access (accounts register, checklist, delivery pack, login sheet) | `src/app/(app)/deals/[id]/access/`, `src/lib/project-access.ts`, `src/lib/pdf/handover-pdf.tsx`, `src/lib/pdf/login-sheet-pdf.tsx`, secret detection in `src/lib/security/secret-guard.ts` |
| Change emails, team chat messages, the morning summary or the calendar feed | `src/lib/integrations/` |
| Change profile photos (size, formats) | `src/lib/avatar.ts`, upload in `src/app/(app)/settings/profile/avatar-*.tsx`, served by `src/app/avatars/` |
| Change sign-in, sessions or two-step sign-in | `src/app/login/`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/security/` |
| Change rate limits | `src/lib/security/rate-limit.ts` (`LIMITS`) |
| Change error alerts or the health check | `src/lib/monitoring/errors.ts`, `src/instrumentation.ts`, `src/app/api/health/` |
| Change colours and fonts | `src/app/globals.css`: `ink-*` greys and `brand-*` crimson at the top, the dark theme below them |
| Change dark/light mode or the switcher | `src/lib/theme/`, `src/components/theme/theme-switcher.tsx` |
| Change the logo | `src/components/brand/` |
| Change the staff guide | `docs/USER-GUIDE.md` |
| Fix a numbering mistake or remove test invoices, receipts or quotes | `docs/DATABASE-FIXES.md` (ready-made SQL for the Neon SQL Editor) |

**Adding a field to something (e.g. a "budget" on deals):** add it in `prisma/schema.prisma` → `pnpm db:migrate --name deal_budget` → add it to the Zod schema in `src/lib/validation/` → add the input to the form and show it on the detail page. Every page and action already re-checks the user's role, so no extra security work is needed.

**Adding a new list, page, report or action that reads leads, deals, quotes, invoices or receipts:** always limit it with `getVisibility(user)` (`where: { AND: [v.deal, …] }`) or check one record with `canSee(user, "deal", id)`. Without that, Sales would see other people's records.

## Settings (environment variables)

Set these in `.env` locally, and in **Vercel → Settings → Environment Variables** for the live CRM. Mark the 🔒 ones **Sensitive**, and **redeploy** after any change.

How to read the table: **🔒** = turn on **Sensitive** in Vercel (it can't be read back, so keep a copy in the password manager). In the **Production** and **Preview** columns, **✅** or a value = add it to that environment, **—** = leave it out of that environment. Tick only the environments shown when you add a variable; don't choose "All Environments".

| Variable | Production | Preview | What it's for |
|---|---|---|---|
| 🔒 `DATABASE_URL` | main Neon database | a **separate** Neon branch | The database. Never point previews at real data. |
| 🔒 `SESSION_SECRET` | ✅ | ✅ different value | Signs sign-in cookies. 48+ random characters. Changing it signs everyone out. |
| 🔒 `DIRECT_URL` | Neon direct URL (no `-pooler`) | only with its own branch | Optional. Used by migrations; falls back to `DATABASE_URL`. |
| 🔒 `ENCRYPTION_KEY` | ✅ | ✅ different value | Optional. Locks two-step sign-in secrets. **Set once, never change.** Derived from `SESSION_SECRET` if unset. |
| `DEFAULT_CURRENCY` | `LKR` | `LKR` | Currency for new deals and report charts |
| `APP_URL` | `https://crm.softrocodelabs.com` | — | Links in emails and calendar events |
| 🔒 `WEBSITE_LEAD_API_KEY` | ✅ | — | Lets the company website send enquiries. Same value in the website project. 24+ characters. |
| `WEBSITE_LEAD_OWNER_EMAIL` | ✅ | — | Who gets an email for each new website enquiry (enquiries wait unassigned on the New Leads board) |
| 🔒 `RESEND_API_KEY` | ✅ | — | Sends emails. Its **own** Resend key (Sending access, softrocodelabs.com only) |
| `EMAIL_FROM` | `Softro CRM <crm@softrocodelabs.com>` | — | Sender address, on a domain verified in Resend |
| 🔒 `CRON_SECRET` | ✅ | — | Protects the 8 am summary job. 16+ characters |
| 🔒 `NEON_API_KEY` | ✅ | — | Optional. Shows Neon compute hours and data transfer in System health. A **project-scoped** key for the CRM project (Neon → Organization settings → API keys) |
| `NEON_PROJECT_ID` | ✅ | — | Optional, with `NEON_API_KEY`. Neon → your project → Settings (e.g. `summer-bush-30064139`) |
| `PLAN_DB_STORAGE_MB`, `PLAN_COMPUTE_HOURS`, `PLAN_TRANSFER_GB` | — | — | Optional. Plan limits for the usage panel. Default to Neon's free plan: 1024, 100, 5. Change them if you upgrade. |
| `MIGRATE_ON_BUILD` | — | `true` only with its own branch | Lets preview deploys update their own database |
| `SEED_ADMIN_*` | — | — | Local `.env` only, used by `pnpm db:seed` |

Make random values with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Keep a copy of every 🔒 value in the company password manager: Vercel won't show them again.

**Previews get less on purpose.** A preview must never change real clients, email the team or receive website enquiries. Without `RESEND_API_KEY` the CRM simply skips emails. The team chat webhook isn't an env var: it's set in **Settings → Integrations**.

## Database changes

- **Making one:** edit `prisma/schema.prisma`, then `pnpm db:migrate --name <short_name>`. Commit the new folder in `prisma/migrations/` with your code.
- **Live database:** applied **automatically** on every Production deploy (`vercel.json` → `scripts/vercel-build.mjs` → `prisma migrate deploy`). If a migration fails, the deploy fails and the previous version stays live.
- **By hand** (rarely needed), in PowerShell: `$env:DATABASE_URL="<neon url>"; pnpm db:deploy; Remove-Item Env:DATABASE_URL`

## Website form → CRM

The "Start your project" form on softrocodelabs.com posts to `POST /api/leads`. Call it from the **website's server code**, never from browser JavaScript:

```ts
await fetch(`${process.env.CRM_URL}/api/leads`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.CRM_LEAD_API_KEY!, // same value as WEBSITE_LEAD_API_KEY
    "x-visitor-ip": visitorIp,                  // optional, for rate limiting
  },
  body: JSON.stringify({
    name: "Saman Kumara",
    contact: "077 123 4567",     // email or WhatsApp number
    service: "Business system",  // the option picked on the form
    message: "We need a POS for our hardware shop…",
    language: "si",              // "en" or "si"
    website: "",                 // hidden honeypot field
  }),
});
```

Responses: `201` created · `401` wrong key · `422` invalid data · `429` too many from one visitor (10 per 10 minutes).

## Tests

| Layer | Command | Covers |
|---|---|---|
| **Unit** (53) | `pnpm test` | Two-step codes (RFC 6238 vectors), encryption, recovery codes, working days in Sri Lanka time, quote maths and VAT, amounts in words, invoice states and balances, ticket SLA, permissions, report periods, CSV safety, email escaping, webhook allow-list, secret guard, avatars, plan usage |
| **Browser** (19) | `pnpm test:e2e` | Health and security headers, sign-in and account lock, viewer limits, two-step set-up / sign-in / recovery code, the 2FA company rule, lead → deal → won → report export, support tickets, theme, profile photos, project access, delivery pack and login sheet, quote → advance invoice → payment and receipt → balance → paid, plan usage panel |

Browser tests create and change records, so run them against a **separate test database**, never Neon:

```powershell
pnpm db:up
docker compose exec db createdb -U softro softro_test     # first time only
$env:DATABASE_URL="postgresql://softro:softro_dev_password@localhost:5432/softro_test?schema=public"
pnpm db:deploy; pnpm db:seed                              # first time only
pnpm build
pnpm exec playwright install chromium                     # first time only
pnpm test:e2e
```

The test accounts (`*@softro.test`) are reset by `tests/e2e/global-setup.ts`, which refuses to run against a `neon.tech` database.

## Checks before merging

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and every push to `main` and `dev`:

**install → lint → type-check → unit tests → dependency audit → build → browser tests (throwaway Postgres 17)**

In GitHub → Settings → Branches, protect `main` so the **CI** checks must pass before merging.

## Going live

1. Add the variables above in Vercel (Production), then deploy. Migrations run by themselves.
2. First time only: `pnpm db:seed` against the live database from your computer, then sign in and change the admin password.
3. Point `crm.softrocodelabs.com` at Vercel (a Cloudflare CNAME, DNS only).

**Checklist**
- [ ] Settings → **System health**: database OK, every required setting shows **Set**, **Plan usage** shows storage (and compute, once `NEON_API_KEY` is set)
- [ ] Vercel on the **Pro** plan: the free Hobby plan is for non-commercial use only
- [ ] Settings → **Integrations**: test email arrives, test chat message arrives
- [ ] A test enquiry from the website appears on **Leads → New web leads** and `WEBSITE_LEAD_OWNER_EMAIL` gets an email
- [ ] Every Sales user has a **Manager (team)** set (Settings → Team members)
- [ ] **Settings → Company details**: BR number filled in (printed on the company seal); each admin and manager has added a **Signature** under My profile
- [ ] **Two-step sign-in** on for every admin, then **Require for admins and managers** switched on (Settings → Security)
- [ ] GitHub secrets `BACKUP_DATABASE_URL` and `BACKUP_PASSPHRASE` set, and **Database backup** run once by hand
- [ ] An uptime monitor (UptimeRobot or Better Stack) watching `https://crm.softrocodelabs.com/api/health`
- [ ] `main` branch protected by the CI checks

**Other hosting** (VPS or Docker): set the same variables, run `pnpm db:deploy` and `pnpm db:seed`, then `pnpm build && pnpm start` or use the `Dockerfile`. Put it behind HTTPS, and call `/api/cron/daily-digest` at 02:30 UTC on weekdays with `Authorization: Bearer $CRON_SECRET`.

## Backups and restore

1. **Neon's restore history**: the quickest fix for "we deleted something this morning". In the Neon console, restore or branch from a past point in time. How far back depends on your Neon plan.
2. **Nightly encrypted copy**: `.github/workflows/backup.yml` runs at 02:00 Sri Lanka time and keeps 30 days as GitHub artifacts (Actions → Database backup → a run → Artifacts). It needs two repository secrets: `BACKUP_DATABASE_URL` (Neon direct URL) and `BACKUP_PASSPHRASE` (in the password manager: **without it the backups can't be opened**). Scheduled jobs only run from the repository's default branch.

**Restoring** (into a **new Neon branch** first, never straight over production):

```bash
gpg --decrypt softro-crm_2026-11-18_0200.dump.gpg > crm.dump    # asks for BACKUP_PASSPHRASE
pg_restore --no-owner --no-acl --dbname="<new branch connection string>" crm.dump
```

Check the data, then make that branch the main one in Neon, or copy back only what was lost. This procedure is tested: the restored row counts match.

## Good to know

- **Every page and every action re-checks the user.** `src/proxy.ts` only redirects signed-out visitors; real permission checks happen in `src/lib/auth.ts` on each request. A deactivated person loses access immediately.
- **Two layers of access.** `permissions.ts` says *what* a role may do; `visibility.ts` says *whose records* they see: Sales (and Support, Viewer) their own, a Manager their own and their team's, Admins everything. This covers leads, deals, quotes, invoices, companies, contacts, contracts, activities and project access (a company or contact tied to a deal you can see is visible too). Website leads nobody has taken are visible to all on the New web leads board; support tickets stay shared.
- **Sealed documents are frozen.** A quote, invoice, receipt or Project Delivery Pack with a `DocumentSeal` can't be edited, deleted, voided, cancelled or updated until an Admin or Manager removes the seal. The signer's name, title and signature are copied into the seal, so the PDF never changes afterwards.
- **Money is never added across currencies.** Totals show per currency (LKR, USD…). Report charts use `DEFAULT_CURRENCY` only and list other currencies separately. The finance pages are all in rupees: a payment on a foreign-currency invoice records the rupees credited (`Payment.amountLkr`).
- **Commission is written when a payment is recorded** (`Commission` rows, at the rates of that moment, on the payment's share without VAT) and deleted with the payment. A payment whose commission is marked paid can't be cancelled until an Admin marks it unpaid.
- **Times are Sri Lanka time** (UTC+05:30) everywhere: reply deadlines, reports, the morning summary. Weekends are skipped; public and poya holidays are not counted yet.
- **Numbers like Q-2026-0001, C-…, T-…** come from the `Counter` table inside a transaction, so two people can never get the same number.
- **Notifications never slow anyone down.** Emails and chat messages are sent after the response (`after()`), and a failed send never breaks the action.
- **Read a migration's SQL before committing it.** Prisma writes it, but a renamed field can come out as "drop and add", which loses data. Rename it by hand in the SQL instead.
- **Dark is the default theme.** It works by redefining the colour tokens on `<html data-theme="dark">`, so screens are written once with the normal classes (`bg-white`, `text-ink-900`, `bg-red-50`…) and both themes just work. Use `text-on-accent` (not `text-white`) for text on a solid colour, and wrap anything that must look the same in both themes in `theme-fixed` (the sidebar, sign-in screens, quote preview, QR codes).
- **Running `next dev`** may create `AGENTS.md` in the root. Commit it or ignore it.
- Release history and the reasoning behind each part are in **[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md#how-it-was-built)**.
