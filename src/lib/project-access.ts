import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AccountOwner, ServiceCategory, SignInMethod, TwoStepMethod } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ACCESS_CHECK_EVERY_DAYS } from "@/lib/crm-meta";
import { fullName } from "@/lib/utils";

const DAY = 86_400_000;
const RENEWAL_NOTICE_DAYS = 30;

export const accessInclude = {
  deal: {
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      companyId: true,
      contactId: true,
      company: { select: { id: true, name: true } },
      contact: { select: { firstName: true, lastName: true } },
      owner: { select: { name: true } },
    },
  },
  lastCheckedBy: { select: { name: true } },
  services: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  handovers: { orderBy: { issuedAt: "desc" }, include: { issuedBy: { select: { name: true } } } },
} satisfies Prisma.ProjectAccessInclude;

export type FullAccess = Prisma.ProjectAccessGetPayload<{ include: typeof accessInclude }>;

export function getAccessForDeal(dealId: string) {
  return db.projectAccess.findUnique({ where: { dealId }, include: accessInclude });
}

/** When the project Gmail should next be signed in to, and how urgent that is. */
export function checkState(access: { googleEmail: string | null; lastCheckedAt: Date | null; createdAt: Date }, now = new Date()) {
  if (!access.googleEmail) return { state: "no-account" as const, dueAt: null };
  const from = access.lastCheckedAt ?? access.createdAt;
  const dueAt = new Date(from.getTime() + ACCESS_CHECK_EVERY_DAYS * DAY);
  if (!access.lastCheckedAt) return { state: "never" as const, dueAt };
  if (dueAt < now) return { state: "overdue" as const, dueAt };
  if (dueAt.getTime() - now.getTime() < 30 * DAY) return { state: "due-soon" as const, dueAt };
  return { state: "ok" as const, dueAt };
}

type DealLink = { id: string; title: string; ownerId: string | null; companyId: string | null; contactId: string | null };

/** Keeps one open task: "sign in to the project Gmail", every 6 months, even after the project is archived. */
export async function syncReviewTask(
  tx: Prisma.TransactionClient,
  access: { id: string; googleEmail: string | null; lastCheckedAt: Date | null; createdAt: Date; reviewTaskId: string | null },
  deal: DealLink,
  actorId: string,
) {
  const existing = access.reviewTaskId ? await tx.activity.findUnique({ where: { id: access.reviewTaskId } }) : null;
  if (!access.googleEmail) {
    if (existing && !existing.completedAt) await tx.activity.delete({ where: { id: existing.id } });
    if (access.reviewTaskId) await tx.projectAccess.update({ where: { id: access.id }, data: { reviewTaskId: null } });
    return;
  }
  const { dueAt } = checkState(access);
  const data = {
    type: "TASK" as const,
    subject: `Check project Gmail: ${deal.title}`,
    description: `Sign in to ${access.googleEmail} and confirm the 2-step codes still work, then press "I signed in and checked it" on the project's Access page. Google can delete personal accounts that aren't used for 2 years.`,
    priority: "MEDIUM" as const,
    dueAt: dueAt!,
    assignedToId: deal.ownerId ?? actorId,
    dealId: deal.id,
  };
  if (existing && !existing.completedAt) {
    await tx.activity.update({ where: { id: existing.id }, data });
  } else {
    const task = await tx.activity.create({ data: { ...data, createdById: actorId } });
    await tx.projectAccess.update({ where: { id: access.id }, data: { reviewTaskId: task.id } });
  }
}

/** A renewal reminder 30 days before a service (domain, hosting plan…) renews. */
export async function syncServiceRenewalTask(
  tx: Prisma.TransactionClient,
  service: { id: string; name: string; owner: AccountOwner; renewsAt: Date | null; renewalTaskId: string | null },
  deal: DealLink,
  actorId: string,
) {
  const existing = service.renewalTaskId ? await tx.activity.findUnique({ where: { id: service.renewalTaskId } }) : null;
  if (!service.renewsAt) {
    if (existing && !existing.completedAt) await tx.activity.delete({ where: { id: existing.id } });
    if (service.renewalTaskId) await tx.projectService.update({ where: { id: service.id }, data: { renewalTaskId: null } });
    return;
  }
  const date = service.renewsAt.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" });
  const data = {
    type: "TASK" as const,
    subject: service.owner === "CLIENT" ? `Remind client to renew ${service.name}: ${deal.title}` : `Renew ${service.name}: ${deal.title}`,
    description: `${service.name} renews on ${date}.${service.owner === "CLIENT" ? " The client owns this account, so remind them." : ""}`,
    priority: "HIGH" as const,
    dueAt: new Date(Math.max(service.renewsAt.getTime() - RENEWAL_NOTICE_DAYS * DAY, Date.now())),
    assignedToId: deal.ownerId ?? actorId,
    dealId: deal.id,
    companyId: deal.companyId,
  };
  if (existing && !existing.completedAt) {
    await tx.activity.update({ where: { id: existing.id }, data });
  } else if (!existing || existing.completedAt) {
    const task = await tx.activity.create({ data: { ...data, createdById: actorId } });
    await tx.projectService.update({ where: { id: service.id }, data: { renewalTaskId: task.id } });
  }
}

/** Removes reminders that belong to services or projects being deleted. */
export async function deleteOpenTasks(tx: Prisma.TransactionClient, ids: (string | null)[]) {
  const list = ids.filter((id): id is string => Boolean(id));
  if (list.length) await tx.activity.deleteMany({ where: { id: { in: list }, completedAt: null } });
}

/* ── Handover document ─────────────────────────────────────────────── */

/** What the client sees. Frozen when issued, so the same PDF can be downloaded again later. No internal notes, no secret locations. */
export type HandoverSnapshot = {
  number: string;
  issuedAt: string;
  issuedBy: string | null;
  project: { title: string; client: string | null; contact: string | null };
  account: { email: string | null; twoStep: TwoStepMethod } | null;
  services: { name: string; category: ServiceCategory; url: string | null; loginEmail: string | null; signIn: SignInMethod; owner: AccountOwner; renewsAt: string | null }[];
  settingsLocation: string | null;
  support: { number: string; title: string; responseTimeHours: number | null; endDate: string | null }[];
};

export async function buildHandoverSnapshot(access: FullAccess, number: string, issuedBy: string | null, now = new Date()): Promise<HandoverSnapshot> {
  const contracts = access.deal.companyId
    ? await db.contract.findMany({
        where: { companyId: access.deal.companyId, status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        select: { number: true, title: true, responseTimeHours: true, endDate: true },
      })
    : [];
  return {
    number,
    issuedAt: now.toISOString(),
    issuedBy,
    project: { title: access.deal.title, client: access.deal.company?.name ?? null, contact: access.deal.contact ? fullName(access.deal.contact) : null },
    account: access.googleEmail ? { email: access.googleEmail, twoStep: access.twoStep } : null,
    services: access.services.map((s) => ({
      name: s.name,
      category: s.category,
      url: s.url,
      loginEmail: s.loginEmail,
      signIn: s.signIn,
      owner: s.owner,
      renewsAt: s.renewsAt?.toISOString() ?? null,
    })),
    settingsLocation: access.envLocation,
    support: contracts.map((c) => ({ ...c, endDate: c.endDate?.toISOString() ?? null })),
  };
}
