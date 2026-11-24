import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleAlert, Globe, Mail, MessagesSquare, Sunrise, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { appUrl } from "@/lib/integrations/app-url";
import { emailConfigured } from "@/lib/integrations/email";
import { chatKind, CHAT_KIND_LABELS } from "@/lib/integrations/chat";
import { colomboWhen } from "@/lib/integrations/notify";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ActionButton, ChatForm } from "./integration-controls";
import { runDigestNow, sendTestChat, sendTestEmail } from "./actions";

export const metadata: Metadata = { title: "Integrations" };

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={ok ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700" : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"}>
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

function Section({ icon: Icon, title, status, children }: { icon: typeof Mail; title: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-ink-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
        </h2>
        {status}
      </div>
      <CardBody className="space-y-3 text-sm text-ink-600">{children}</CardBody>
    </Card>
  );
}

const Env = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs text-ink-800">{children}</code>;

/** Outside the component so the lint rule for pure renders is satisfied; server pages render per request anyway. */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

function mask(url: string) {
  try {
    const u = new URL(url);
    return `${u.host}/…${url.slice(-6)}`;
  } catch {
    return "…";
  }
}

export default async function IntegrationsPage() {
  await requirePermission("integration:manage");
  const [org, lastWebsiteLead, websiteLeads30, calendarUsers, owner] = await Promise.all([
    db.orgSettings.findUnique({ where: { id: "default" } }),
    db.lead.findFirst({ where: { source: "WEBSITE_FORM" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.lead.count({ where: { source: "WEBSITE_FORM", createdAt: { gte: daysAgo(30) } } }),
    db.user.count({ where: { calendarTokenHash: { not: null }, isActive: true } }),
    process.env.WEBSITE_LEAD_OWNER_EMAIL ? db.user.findUnique({ where: { email: process.env.WEBSITE_LEAD_OWNER_EMAIL.toLowerCase() }, select: { name: true, isActive: true } }) : null,
  ]);
  const emailOk = emailConfigured();
  const chatUrl = org?.chatWebhookUrl ?? null;
  const kind = chatUrl ? chatKind(chatUrl) : null;
  const leadKeyOk = (process.env.WEBSITE_LEAD_API_KEY?.length ?? 0) >= 24;
  const cronOk = (process.env.CRON_SECRET?.length ?? 0) >= 16;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Integrations" description="Connect Softro CRM to email, your team chat, the website and calendars." breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Integrations" }]} />

      <Section icon={Mail} title="Email (Resend)" status={<Status ok={emailOk}>{emailOk ? "Connected" : "Not set up"}</Status>}>
        <p>Sends assignment emails, new-enquiry alerts and morning summaries. Uses the same Resend account as the website.</p>
        {emailOk ? (
          <p>
            Sending from <strong className="text-ink-800">{process.env.EMAIL_FROM}</strong>.
          </p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            <li>In Resend, make sure <strong>softrocodelabs.com</strong> is a verified domain, and create an API key with “Sending access”.</li>
            <li>
              In Vercel → Settings → Environment Variables, add <Env>RESEND_API_KEY</Env> and <Env>EMAIL_FROM</Env> (e.g. <Env>Softro CRM &lt;crm@softrocodelabs.com&gt;</Env>), then redeploy.
            </li>
          </ol>
        )}
        <ActionButton action={sendTestEmail}>Send me a test email</ActionButton>
      </Section>

      <Section icon={MessagesSquare} title="Team chat" status={<Status ok={Boolean(kind)}>{kind ? CHAT_KIND_LABELS[kind] : "Not connected"}</Status>}>
        <p>
          Posts short alerts to a channel in <strong>Slack</strong>, <strong>Google Chat</strong>, <strong>Discord</strong> or <strong>Microsoft Teams</strong>. Create an <em>incoming webhook</em> for the channel in that app and paste its address here. Keep the address private: anyone with it can post to the channel.
        </p>
        <ChatForm
          connected={Boolean(kind)}
          masked={chatUrl ? mask(chatUrl) : null}
          kindLabel={kind ? CHAT_KIND_LABELS[kind] : null}
          initial={{ chatNotifyLeads: org?.chatNotifyLeads ?? true, chatNotifyWins: org?.chatNotifyWins ?? true, chatNotifyTickets: org?.chatNotifyTickets ?? true }}
        />
        {kind && <ActionButton action={sendTestChat}>Send a test message</ActionButton>}
      </Section>

      <Section icon={Globe} title="Website enquiry form" status={<Status ok={leadKeyOk}>{leadKeyOk ? "Connected" : "API key missing"}</Status>}>
        <p>
          The “Start your project” form on softrocodelabs.com sends enquiries to <Env>{appUrl("/api/leads")}</Env> using <Env>WEBSITE_LEAD_API_KEY</Env>.
        </p>
        <ul className="space-y-1">
          <li>
            New enquiries wait on the New Leads board. Email alert goes to:{" "}
            {owner ? (
              <strong className="text-ink-800">
                {owner.name}
                {!owner.isActive && " (deactivated, so no alert is sent)"}
              </strong>
            ) : process.env.WEBSITE_LEAD_OWNER_EMAIL ? (
              <span className="text-red-600">{process.env.WEBSITE_LEAD_OWNER_EMAIL} isn&apos;t a CRM user, so no alert is sent</span>
            ) : (
              <span>nobody (set <Env>WEBSITE_LEAD_OWNER_EMAIL</Env>)</span>
            )}
          </li>
          <li>
            Last enquiry: <strong className="text-ink-800">{lastWebsiteLead ? colomboWhen(lastWebsiteLead.createdAt) : "none yet"}</strong> · {websiteLeads30} in the last 30 days
          </li>
        </ul>
      </Section>

      <Section
        icon={Sunrise}
        title="Morning summary"
        status={<Status ok={cronOk && emailOk}>{cronOk && emailOk ? "On" : !emailOk ? "Needs email" : "CRON_SECRET missing"}</Status>}
      >
        <p>At 8 am on working days, everyone who has it switched on gets one email with their overdue and today&apos;s tasks, leads waiting for a reply, tickets needing a first reply and deals past their close date. People with nothing due get no email.</p>
        {!cronOk && (
          <p>
            Add <Env>CRON_SECRET</Env> (any random text, 16+ characters) in Vercel and redeploy. Vercel then runs it on the schedule in <Env>vercel.json</Env>.
          </p>
        )}
        <p>
          Last sent: <strong className="text-ink-800">{org?.digestLastRunAt ? `${colomboWhen(org.digestLastRunAt)} (${org.digestLastSent ?? 0} emails)` : "never"}</strong>
        </p>
        <ActionButton action={runDigestNow} confirm="Send today's morning summary to everyone now? It won't be sent again today.">
          Send today&apos;s summaries now
        </ActionButton>
      </Section>

      <Section icon={CalendarDays} title="Calendar links" status={<Status ok>{`${calendarUsers} ${calendarUsers === 1 ? "person" : "people"} using it`}</Status>}>
        <p>
          Each person can add their tasks, calls and meetings to Google Calendar or Outlook from <Link href="/settings/profile" className="font-medium text-brand-700 hover:underline">My profile → Calendar</Link>. Links are private and can be reset at any time. Deactivating a user stops their link.
        </p>
      </Section>

      <Section icon={Wallet} title="Accounting export" status={<Status ok>Ready</Status>}>
        <p>
          Download accepted quotes with subtotal, discount, VAT and total for your accountant or accounting software (Excel, QuickBooks, Xero or Zoho Books import). Go to{" "}
          <Link href="/reports" className="font-medium text-brand-700 hover:underline">Reports</Link> → Export CSV → <strong>Accepted quotes</strong>.
        </p>
      </Section>
    </div>
  );
}
