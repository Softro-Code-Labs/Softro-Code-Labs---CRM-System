import "server-only";
import { db } from "@/lib/db";
import { formatMoney, fullName } from "@/lib/utils";
import { ACTIVITY_TYPE_LABELS, LEAD_SOURCE_LABELS, SERVICE_TYPE_LABELS, TICKET_PRIORITY_LABELS } from "@/lib/crm-meta";
import { appUrl } from "./app-url";
import { sendEmail } from "./email";
import { postToChat, type ChatMessage } from "./chat";
import { renderEmail } from "./email-template";

/**
 * Notification events. Call these inside `after(() => …)` so the person who made the change
 * never waits for an email or chat message, and a failed send never breaks their action.
 * Nobody is emailed about something they did themselves.
 */

const when = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Colombo" });
export const colomboWhen = (d: Date) => when.format(d);

type Recipient = { id: string; name: string; email: string; isActive: boolean; emailNotifications: boolean };
const recipientSelect = { id: true, name: true, email: true, isActive: true, emailNotifications: true } as const;

function shouldEmail(user: Recipient | null | undefined, actorId: string | null): user is Recipient {
  return Boolean(user && user.isActive && user.emailNotifications && user.id !== actorId);
}

async function chat(kind: "leads" | "wins" | "tickets", message: ChatMessage) {
  const s = await db.orgSettings.findUnique({ where: { id: "default" }, select: { chatWebhookUrl: true, chatNotifyLeads: true, chatNotifyWins: true, chatNotifyTickets: true } });
  if (!s?.chatWebhookUrl) return;
  const on = { leads: s.chatNotifyLeads, wins: s.chatNotifyWins, tickets: s.chatNotifyTickets }[kind];
  if (on) await postToChat(s.chatWebhookUrl, message);
}

/** Runs every notifier and never throws: a broken integration must not break the CRM. */
async function safely(label: string, ...jobs: Promise<unknown>[]) {
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected") console.error(`[notify] ${label}:`, r.reason);
}

/* ---------------------------------------------------------------- Leads */

export async function notifyNewWebsiteLead(leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: { select: recipientSelect } } });
  if (!lead) return;
  // Website leads start unassigned on the New Leads board; WEBSITE_LEAD_OWNER_EMAIL gets an email alert.
  const alertEmail = process.env.WEBSITE_LEAD_OWNER_EMAIL?.toLowerCase();
  const recipient = lead.owner ?? (alertEmail ? await db.user.findUnique({ where: { email: alertEmail }, select: recipientSelect }) : null);
  const url = appUrl(`/leads/${lead.id}`);
  const who = [lead.contactName, lead.companyName].filter(Boolean).join(", ") || lead.email || "Someone";
  const details: [string, string][] = [
    ["From", who],
    ...(lead.email ? [["Email", lead.email] as [string, string]] : []),
    ...(lead.phone || lead.whatsapp ? [["Phone / WhatsApp", (lead.whatsapp ?? lead.phone)!] as [string, string]] : []),
    ...(lead.serviceType ? [["Service", SERVICE_TYPE_LABELS[lead.serviceType]] as [string, string]] : []),
    ...(lead.estimatedValue ? [["Budget", formatMoney(lead.estimatedValue, lead.currency)] as [string, string]] : []),
    ...(lead.respondBy ? [["Reply by", colomboWhen(lead.respondBy)] as [string, string]] : []),
  ];
  const jobs: Promise<unknown>[] = [
    chat("leads", { title: `New website enquiry: ${lead.title}`, lines: [who, lead.serviceType ? SERVICE_TYPE_LABELS[lead.serviceType] : "", lead.owner ? `Assigned to ${lead.owner.name}` : "On the New Leads board: first to take it owns it"], url, linkLabel: "Open lead" }),
  ];
  if (shouldEmail(recipient, null)) {
    const { html, text } = renderEmail({
      preheader: `${who} sent an enquiry through the website.`,
      title: `New enquiry: ${lead.title}`,
      intro: `${who} filled in the form on softrocodelabs.com. We promise a reply within 2 working days.`,
      rows: details,
      sections: lead.description ? [{ heading: "Their message", items: [{ text: lead.description.slice(0, 1500) }] }] : undefined,
      button: { label: "Open lead", url },
    });
    jobs.push(sendEmail({ to: recipient.email, subject: `New enquiry: ${lead.title}`, html, text, replyTo: lead.email ?? undefined }));
  }
  await safely("new website lead", ...jobs);
}

export async function notifyLeadAssigned(leadId: string, actorId: string | null) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: { select: recipientSelect } } });
  if (!lead || !shouldEmail(lead.owner, actorId)) return;
  const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
  const url = appUrl(`/leads/${lead.id}`);
  const { html, text } = renderEmail({
    preheader: `${actor?.name ?? "Someone"} gave you a lead.`,
    title: `Lead assigned to you: ${lead.title}`,
    intro: `${actor?.name ?? "Someone"} assigned this lead to you.`,
    rows: [
      ["Contact", [lead.contactName, lead.companyName].filter(Boolean).join(", ") || "—"],
      ["Source", LEAD_SOURCE_LABELS[lead.source]],
      ...(lead.respondBy && !lead.respondedAt ? [["Reply by", colomboWhen(lead.respondBy)] as [string, string]] : []),
    ],
    button: { label: "Open lead", url },
  });
  await safely("lead assigned", sendEmail({ to: lead.owner.email, subject: `Lead assigned to you: ${lead.title}`, html, text }));
}

/* ---------------------------------------------------------------- Deals */

export async function notifyDealWon(dealId: string, actorId: string | null) {
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: { company: { select: { name: true } }, owner: { select: { name: true } } } });
  if (!deal || deal.status !== "WON") return;
  const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
  await safely(
    "deal won",
    chat("wins", {
      title: `🎉 Deal won: ${deal.title}`,
      lines: [[deal.company?.name, formatMoney(deal.value, deal.currency)].filter(Boolean).join(" · "), `Won by ${deal.owner?.name ?? actor?.name ?? "the team"}`],
      url: appUrl(`/deals/${deal.id}`),
      linkLabel: "Open deal",
    }),
  );
}

/* ----------------------------------------------------------- Activities */

export async function notifyTaskAssigned(activityId: string, actorId: string | null) {
  const a = await db.activity.findUnique({
    where: { id: activityId },
    include: {
      assignedTo: { select: recipientSelect },
      lead: { select: { id: true, title: true } },
      deal: { select: { id: true, title: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!a || a.completedAt || !shouldEmail(a.assignedTo, actorId)) return;
  const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
  const about = a.deal ? `Deal: ${a.deal.title}` : a.lead ? `Lead: ${a.lead.title}` : a.company ? a.company.name : a.contact ? fullName(a.contact) : null;
  const url = appUrl(a.deal ? `/deals/${a.deal.id}` : a.lead ? `/leads/${a.lead.id}` : a.company ? `/companies/${a.company.id}` : a.contact ? `/contacts/${a.contact.id}` : "/activities");
  const kind = ACTIVITY_TYPE_LABELS[a.type];
  const { html, text } = renderEmail({
    preheader: `${actor?.name ?? "Someone"} gave you a ${kind.toLowerCase()}${a.dueAt ? ` due ${colomboWhen(a.dueAt)}` : ""}.`,
    title: `${kind} for you: ${a.subject}`,
    intro: `${actor?.name ?? "Someone"} assigned this to you.`,
    rows: [
      ...(a.dueAt ? [["Due", colomboWhen(a.dueAt)] as [string, string]] : []),
      ["Priority", a.priority.charAt(0) + a.priority.slice(1).toLowerCase()],
      ...(about ? [["About", about] as [string, string]] : []),
    ],
    sections: a.description ? [{ heading: "Details", items: [{ text: a.description.slice(0, 1500) }] }] : undefined,
    button: { label: "Open in Softro CRM", url },
  });
  await safely("task assigned", sendEmail({ to: a.assignedTo.email, subject: `${kind} for you: ${a.subject}`, html, text }));
}

/* -------------------------------------------------------------- Tickets */

export async function notifyTicket(ticketId: string, actorId: string | null, event: "created" | "assigned") {
  const t = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedTo: { select: recipientSelect }, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } }, contract: { select: { number: true } } },
  });
  if (!t) return;
  const url = appUrl(`/support/${t.id}`);
  const client = t.company?.name ?? (t.contact ? fullName(t.contact) : "a client");
  const jobs: Promise<unknown>[] = [];
  if (event === "created" && (t.priority === "URGENT" || t.priority === "HIGH")) {
    jobs.push(
      chat("tickets", {
        title: `${t.priority === "URGENT" ? "🚨 Urgent" : "High-priority"} ticket ${t.number}: ${t.subject}`,
        lines: [client, t.assignedTo ? `Assigned to ${t.assignedTo.name}` : "Not assigned", t.responseDueAt ? `First reply due ${colomboWhen(t.responseDueAt)}` : ""],
        url,
        linkLabel: "Open ticket",
      }),
    );
  }
  if (shouldEmail(t.assignedTo, actorId)) {
    const actor = actorId ? await db.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
    const subject = `${t.priority === "URGENT" ? "[Urgent] " : ""}Ticket ${t.number} assigned to you: ${t.subject}`;
    const { html, text } = renderEmail({
      preheader: `${client}${t.responseDueAt ? `, first reply due ${colomboWhen(t.responseDueAt)}` : ""}.`,
      title: `Ticket ${t.number}: ${t.subject}`,
      intro: `${actor?.name ?? "Someone"} ${event === "created" ? "opened this ticket and assigned it" : "assigned this ticket"} to you.`,
      rows: [
        ["Client", client],
        ["Priority", TICKET_PRIORITY_LABELS[t.priority]],
        ...(t.responseDueAt && !t.firstResponseAt ? [["First reply due", colomboWhen(t.responseDueAt)] as [string, string]] : []),
        ...(t.contract ? [["Contract", t.contract.number] as [string, string]] : []),
      ],
      sections: t.description ? [{ heading: "The problem", items: [{ text: t.description.slice(0, 1500) }] }] : undefined,
      button: { label: "Open ticket", url },
    });
    jobs.push(sendEmail({ to: t.assignedTo.email, subject, html, text }));
  }
  await safely(`ticket ${event}`, ...jobs);
}
