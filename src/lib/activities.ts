import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Target } from "@/lib/validation/activity";

export type Links = { leadId: string | null; dealId: string | null; companyId: string | null; contactId: string | null };

/**
 * Expands the record something was logged on into all the records it should
 * appear on. A call logged on a deal also shows on that deal's company and
 * contact, so a company's timeline tells the whole story.
 */
export async function resolveLinks(target: Target): Promise<Links | null> {
  if (target.dealId) {
    const deal = await db.deal.findUnique({ where: { id: target.dealId }, select: { id: true, companyId: true, contactId: true } });
    return deal && { leadId: null, dealId: deal.id, companyId: deal.companyId, contactId: deal.contactId };
  }
  if (target.leadId) {
    const lead = await db.lead.findUnique({ where: { id: target.leadId }, select: { id: true, companyId: true } });
    return lead && { leadId: lead.id, dealId: null, companyId: lead.companyId, contactId: null };
  }
  if (target.contactId) {
    const contact = await db.contact.findUnique({ where: { id: target.contactId }, select: { id: true, companyId: true } });
    return contact && { leadId: null, dealId: null, companyId: contact.companyId, contactId: contact.id };
  }
  if (target.companyId) {
    const company = await db.company.findUnique({ where: { id: target.companyId }, select: { id: true } });
    return company && { leadId: null, dealId: null, companyId: company.id, contactId: null };
  }
  return null;
}

/** Pages that show an item with these links. */
export function pathsFor(links: Partial<Links>) {
  return [
    "/activities",
    "/dashboard",
    links.leadId && `/leads/${links.leadId}`,
    links.dealId && `/deals/${links.dealId}`,
    links.companyId && `/companies/${links.companyId}`,
    links.contactId && `/contacts/${links.contactId}`,
  ].filter(Boolean) as string[];
}

/** Which activities and notes belong on a record's timeline. */
async function timelineWhere(target: Target): Promise<{ activity: Prisma.ActivityWhereInput; note: Prisma.NoteWhereInput }> {
  if (target.dealId) {
    // A deal also shows the history of the lead it came from.
    const deal = await db.deal.findUnique({ where: { id: target.dealId }, select: { leadId: true } });
    const or = [{ dealId: target.dealId }, ...(deal?.leadId ? [{ leadId: deal.leadId }] : [])];
    return { activity: { OR: or }, note: { OR: or } };
  }
  if (target.leadId) return { activity: { leadId: target.leadId }, note: { leadId: target.leadId } };
  if (target.contactId) return { activity: { contactId: target.contactId }, note: { contactId: target.contactId } };
  return { activity: { companyId: target.companyId! }, note: { companyId: target.companyId! } };
}

const activitySelect = {
  id: true,
  type: true,
  subject: true,
  description: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  assignedToId: true,
  createdById: true,
  assignedTo: { select: { name: true } },
  createdBy: { select: { name: true } },
  lead: { select: { id: true, title: true } },
  deal: { select: { id: true, title: true } },
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ActivitySelect;

export type ActivityRow = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;

export async function getTimeline(target: Target) {
  const where = await timelineWhere(target);
  const [activities, notes] = await Promise.all([
    db.activity.findMany({ where: where.activity, select: activitySelect, orderBy: { createdAt: "desc" }, take: 200 }),
    db.note.findMany({
      where: where.note,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, body: true, createdAt: true, authorId: true, author: { select: { name: true } } },
    }),
  ]);

  const upcoming = activities
    .filter((a) => !a.completedAt)
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));

  type HistoryItem =
    | { kind: "activity"; at: Date; activity: ActivityRow }
    | { kind: "note"; at: Date; note: (typeof notes)[number] };
  const history: HistoryItem[] = [
    ...activities.filter((a) => a.completedAt).map((a) => ({ kind: "activity" as const, at: a.completedAt!, activity: a })),
    ...notes.map((n) => ({ kind: "note" as const, at: n.createdAt, note: n })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return { upcoming, history };
}

export { activitySelect };
