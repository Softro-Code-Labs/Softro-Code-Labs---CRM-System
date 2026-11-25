import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { OPEN_LEAD_STATUSES } from "@/lib/crm-meta";

type Viewer = { id: string; role: Role };

const memberSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  jobTitle: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  avatarUpdatedAt: true,
  managerId: true,
  manager: { select: { id: true, name: true } },
} as const;

/** The people this viewer looks after: a Manager's own team; for an Admin, everyone who is in a team or could be. */
export async function getTeamMembers(viewer: Viewer) {
  return db.user.findMany({
    where: viewer.role === "ADMIN" ? { role: { notIn: ["ADMIN", "MANAGER"] } } : { managerId: viewer.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: memberSelect,
  });
}

/** One team member, if this viewer may see them: an Admin always, a Manager only for their own team. */
export async function getTeamMember(viewer: Viewer, id: string) {
  const member = await db.user.findUnique({ where: { id }, select: memberSelect });
  if (!member || member.role === "ADMIN" || member.role === "MANAGER") return null;
  if (viewer.role !== "ADMIN" && member.managerId !== viewer.id) return null;
  return member;
}

/** Open work per person: leads, open deals and their value, quotes waiting on the client, overdue tasks. */
export async function getWorkload(ids: string[], now = new Date()) {
  if (!ids.length) return new Map<string, Workload>();
  const [leads, deals, quotes, overdue] = await Promise.all([
    db.lead.groupBy({ by: ["ownerId"], where: { ownerId: { in: ids }, status: { in: OPEN_LEAD_STATUSES } }, _count: { _all: true } }),
    db.deal.groupBy({ by: ["ownerId", "currency"], where: { ownerId: { in: ids }, status: "OPEN" }, _count: { _all: true }, _sum: { value: true } }),
    db.quote.groupBy({ by: ["createdById"], where: { createdById: { in: ids }, status: "SENT" }, _count: { _all: true } }),
    db.activity.groupBy({ by: ["assignedToId"], where: { assignedToId: { in: ids }, completedAt: null, dueAt: { lt: now } }, _count: { _all: true } }),
  ]);
  const map = new Map<string, Workload>(ids.map((id) => [id, { leads: 0, deals: 0, pipeline: [], quotes: 0, overdue: 0 }]));
  for (const l of leads) if (l.ownerId) map.get(l.ownerId)!.leads = l._count._all;
  for (const d of deals) {
    if (!d.ownerId) continue;
    const w = map.get(d.ownerId)!;
    w.deals += d._count._all;
    w.pipeline.push({ currency: d.currency, value: Number(d._sum.value ?? 0) });
  }
  for (const q of quotes) if (q.createdById) map.get(q.createdById)!.quotes = q._count._all;
  for (const a of overdue) if (a.assignedToId) map.get(a.assignedToId)!.overdue = a._count._all;
  return map;
}

export type Workload = { leads: number; deals: number; pipeline: { currency: string; value: number }[]; quotes: number; overdue: number };
