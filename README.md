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
- Sessions are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie (and `Secure` in production), valid for 7 days.
- `proxy.ts` blocks signed-out visitors from loading pages. **Every** page and server action also re-checks the user and their role through `src/lib/auth.ts`, so deactivating a user locks them out immediately.
- Roles: `ADMIN`, `MANAGER`, `SALES`, `SUPPORT`, `VIEWER`. The rules live in `src/lib/permissions.ts`.
- Every create, update, delete, login and logout is written to the `AuditLog` table.
- Security headers are set in `next.config.ts`.

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

## Deploying

1. Set `DATABASE_URL`, a strong random `SESSION_SECRET` (48+ characters) and `DEFAULT_CURRENCY` on the server.
2. Run `npm run db:deploy`, then `npm run db:seed` once.
3. Either `npm run build && npm start`, or build the included `Dockerfile` (standalone output, runs as a non-root user).
4. Put it behind HTTPS (Nginx or Caddy, or a platform like Railway, Render or a VPS).

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
| **7. Reports & dashboard** | Pipeline forecast · win rate · revenue by client/service · team performance · CSV export | ⏭ Next |
| **8. Integrations** | Email (Gmail/Outlook) · website lead capture form/API · Slack or WhatsApp notifications · accounting export | |
| **9. Hardening** | Automated tests (Playwright) · rate limiting on login · 2FA · backups · error monitoring · CI/CD | |
