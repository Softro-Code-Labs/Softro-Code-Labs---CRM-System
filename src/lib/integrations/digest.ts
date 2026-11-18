import "server-only";
import { db } from "@/lib/db";
import { colomboDayBounds } from "@/lib/working-days";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm-meta";
import { appUrl } from "./app-url";
import { sendEmail, type SendResult } from "./email";
import { renderEmail, type EmailSection } from "./email-template";
import { colomboWhen } from "./notify";
import { usageWarnings } from "@/lib/usage";

/**
 * The 8 am "your day" email: overdue and today's tasks, leads waiting for a reply,
 * tickets whose first reply is due, and deals whose close date has passed.
 * Admins also get a warning when a plan limit (database storage, compute) passes 80%.
 * Nothing to report means no email.
 */
const LIMIT = 8;
const OPEN_TICKET = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

export async function buildDigest(userId: string, now = new Date()) {
  const { start, end } = colomboDayBounds(now);
  const [tasks, leads, tickets, deals, user] = await Promise.all([
    db.activity.findMany({
      where: { assignedToId: userId, completedAt: null, dueAt: { lt: end } },
      orderBy: { dueAt: "asc" },
      take: 30,
      select: { id: true, type: true, subject: true, dueAt: true, leadId: true, dealId: true, companyId: true, contactId: true },
    }),
    db.lead.findMany({
      where: { ownerId: userId, respondedAt: null, status: "NEW", respondBy: { lt: end } },
      orderBy: { respondBy: "asc" },
      take: 30,
      select: { id: true, title: true, respondBy: true },
    }),
    db.ticket.findMany({
      where: { assignedToId: userId, status: { in: [...OPEN_TICKET] }, firstResponseAt: null, responseDueAt: { lt: end } },
      orderBy: { responseDueAt: "asc" },
      take: 30,
      select: { id: true, number: true, subject: true, responseDueAt: true },
    }),
    db.deal.findMany({
      where: { ownerId: userId, status: "OPEN", expectedCloseDate: { lt: start } },
      orderBy: { expectedCloseDate: "asc" },
      take: 30,
      select: { id: true, title: true, expectedCloseDate: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  const limits = user?.role === "ADMIN" ? await usageWarnings() : [];

  const late = (d: Date | null) => Boolean(d && d < now);
  const more = (n: number, label: string) => (n > LIMIT ? [{ text: `…and ${n - LIMIT} more ${label}`, url: undefined }] : []);
  const sections: EmailSection[] = [];
  if (tasks.length)
    sections.push({
      heading: `Tasks (${tasks.length})`,
      items: [
        ...tasks.slice(0, LIMIT).map((t) => ({
          text: `${ACTIVITY_TYPE_LABELS[t.type]}: ${t.subject}`,
          meta: t.dueAt ? `${late(t.dueAt) && t.dueAt < start ? "Overdue, was due" : "Due"} ${colomboWhen(t.dueAt)}` : undefined,
          urgent: Boolean(t.dueAt && t.dueAt < start),
          url: appUrl(t.dealId ? `/deals/${t.dealId}` : t.leadId ? `/leads/${t.leadId}` : t.companyId ? `/companies/${t.companyId}` : t.contactId ? `/contacts/${t.contactId}` : "/activities"),
        })),
        ...more(tasks.length, "tasks"),
      ],
    });
  if (leads.length)
    sections.push({
      heading: `Leads waiting for a reply (${leads.length})`,
      items: [
        ...leads.slice(0, LIMIT).map((l) => ({ text: l.title, meta: `${late(l.respondBy) ? "Reply overdue since" : "Reply by"} ${colomboWhen(l.respondBy!)}`, urgent: late(l.respondBy), url: appUrl(`/leads/${l.id}`) })),
        ...more(leads.length, "leads"),
      ],
    });
  if (tickets.length)
    sections.push({
      heading: `Tickets needing a first reply (${tickets.length})`,
      items: [
        ...tickets.slice(0, LIMIT).map((t) => ({ text: `${t.number}: ${t.subject}`, meta: `${late(t.responseDueAt) ? "Overdue since" : "Reply by"} ${colomboWhen(t.responseDueAt!)}`, urgent: late(t.responseDueAt), url: appUrl(`/support/${t.id}`) })),
        ...more(tickets.length, "tickets"),
      ],
    });
  if (deals.length)
    sections.push({
      heading: `Deals past their close date (${deals.length})`,
      items: [
        ...deals.slice(0, LIMIT).map((d) => ({ text: d.title, meta: `Expected to close ${colomboWhen(d.expectedCloseDate!).replace(/,? \d{1,2}:\d{2}.*$/, "")}. Update the date or close it.`, url: appUrl(`/deals/${d.id}`) })),
        ...more(deals.length, "deals"),
      ],
    });

  if (limits.length)
    sections.push({
      heading: "Plan limits (admins)",
      items: limits.map((m) => ({
        text: `${m.label}: ${m.display}${m.percent != null ? ` (${m.percent}%)` : ""}`,
        meta:
          m.key === "storage"
            ? m.level === "full"
              ? "Nearly full: saving will start failing. Upgrade Neon or free space now."
              : "Over 80%. Plan an upgrade or free some space."
            : m.level === "full"
              ? "Nearly used up: the database pauses until next month when it runs out. Upgrade Neon now."
              : "Over 80% for this month. Watch it, or upgrade Neon.",
        urgent: m.level === "full",
        url: appUrl("/settings/system"),
      })),
    });

  const overdue = tasks.filter((t) => t.dueAt && t.dueAt < start).length + leads.filter((l) => late(l.respondBy)).length + tickets.filter((t) => late(t.responseDueAt)).length;
  return { sections, overdue, total: tasks.length + leads.length + tickets.length + deals.length + limits.length };
}

const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Colombo" });

export async function sendDigest(user: { id: string; name: string; email: string }, now = new Date(), opts: { evenIfEmpty?: boolean } = {}): Promise<SendResult | null> {
  const digest = await buildDigest(user.id, now);
  if (!digest.total && !opts.evenIfEmpty) return null;
  const first = user.name.split(" ")[0];
  const title = digest.total ? `Good morning ${first}: ${digest.total} ${digest.total === 1 ? "thing" : "things"} for today` : `Good morning ${first}: you're all caught up`;
  const { html, text } = renderEmail({
    preheader: digest.overdue ? `${digest.overdue} overdue. Start with those.` : "Here's what's on your plate today.",
    title,
    intro: digest.total ? (digest.overdue ? `${digest.overdue} ${digest.overdue === 1 ? "item is" : "items are"} overdue. Start with those (marked in red).` : "Nothing is overdue. Here's what's due today.") : "No tasks, replies or tickets are due today.",
    sections: digest.sections,
    button: { label: "Open my dashboard", url: appUrl("/dashboard") },
    footer: "Sent at 8 am on working days. Turn it off under My profile → Notifications.",
  });
  return sendEmail({ to: user.email, subject: `${digest.overdue ? "⚠ " : ""}Your day, ${dayName.format(now)}`, html, text });
}

/** Sends everyone who wants it their summary. Safe to call twice in a day: the second call does nothing. */
export async function runDailyDigest(now = new Date(), { force = false } = {}) {
  const { start } = colomboDayBounds(now);
  const org = await db.orgSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" }, select: { digestLastRunAt: true } });
  if (!force && org.digestLastRunAt && org.digestLastRunAt >= start) return { skipped: "already sent today" as const, sent: 0, failed: 0 };
  // Claim today's run first so an overlapping retry can't double-send.
  const claimed = await db.orgSettings.updateMany({
    where: { id: "default", ...(force ? {} : { OR: [{ digestLastRunAt: null }, { digestLastRunAt: { lt: start } }] }) },
    data: { digestLastRunAt: now },
  });
  if (!claimed.count) return { skipped: "already sent today" as const, sent: 0, failed: 0 };

  const users = await db.user.findMany({ where: { isActive: true, dailyDigest: true }, select: { id: true, name: true, email: true } });
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    try {
      const r = await sendDigest(u, now);
      if (r?.ok) sent++;
      else if (r && !r.ok) failed++;
    } catch (e) {
      failed++;
      console.error(`[digest] ${u.email}:`, e);
    }
  }
  await db.orgSettings.update({ where: { id: "default" }, data: { digestLastSent: sent } });
  return { skipped: null, sent, failed, users: users.length };
}
