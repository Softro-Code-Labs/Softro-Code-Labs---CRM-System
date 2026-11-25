"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { canSee } from "@/lib/visibility";
import type { Role } from "@/generated/prisma/enums";

/** Project access follows its deal: only people who can see the deal can read or change it. */
async function mayUse(user: { id: string; role: Role }, dealId: string) {
  return canSee(user, "deal", dealId);
}
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { accessSchema, serviceSchema } from "@/lib/validation/access";
import { ACCESS_CHECKLIST, type AccessChecklistKey } from "@/lib/crm-meta";
import { nextNumber } from "@/lib/numbering";
import { accessInclude, buildHandoverSnapshot, deleteOpenTasks, syncReviewTask, syncServiceRenewalTask, type HandoverDocsChoice, type HandoverSnapshot } from "@/lib/project-access";

type Result = { ok?: boolean; message?: string };

const dealSelect = { id: true, title: true, ownerId: true, companyId: true, contactId: true } as const;

function refresh(dealId: string) {
  revalidatePath(`/deals/${dealId}/access`);
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/access");
  revalidatePath("/activities");
  revalidatePath("/dashboard");
}

async function loadAccess(accessId: string, user: { id: string; role: Role }) {
  const access = await db.projectAccess.findUnique({ where: { id: accessId }, include: { deal: { select: dealSelect } } });
  return access && (await mayUse(user, access.dealId)) ? access : null;
}

/** Creates or updates the project's Google account details. */
export async function saveAccess(dealId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = accessSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const deal = await db.deal.findUnique({ where: { id: dealId }, select: dealSelect });
  if (!deal || !(await mayUse(user, dealId))) return { message: "This project no longer exists." };
  const existed = await db.projectAccess.findUnique({ where: { dealId }, select: { id: true } });

  await db.$transaction(async (tx) => {
    const access = await tx.projectAccess.upsert({ where: { dealId }, create: { dealId, ...parsed.data }, update: parsed.data });
    await syncReviewTask(tx, access, deal, user.id);
  });
  await audit({ actorId: user.id, action: existed ? "update" : "create", entity: "ProjectAccess", entityId: dealId, summary: `Project access: ${deal.title}` });
  refresh(dealId);
  return { ok: true, message: "Saved." };
}

export async function saveService(accessId: string, serviceId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = serviceSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const access = await loadAccess(accessId, user);
  if (!access) return { message: "This project no longer exists." };

  await db.$transaction(async (tx) => {
    let service;
    if (serviceId) {
      service = await tx.projectService.update({ where: { id: serviceId, accessId }, data: parsed.data });
    } else {
      const position = await tx.projectService.count({ where: { accessId } });
      service = await tx.projectService.create({ data: { ...parsed.data, accessId, position } });
    }
    await syncServiceRenewalTask(tx, service, access.deal, user.id);
  });
  await audit({ actorId: user.id, action: serviceId ? "update" : "create", entity: "ProjectAccess", entityId: access.dealId, summary: `${parsed.data.name} account: ${access.deal.title}` });
  refresh(access.dealId);
  return { ok: true, message: serviceId ? "Service updated." : "Service added." };
}

export async function deleteService(serviceId: string): Promise<Result> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const service = await db.projectService.findUnique({ where: { id: serviceId }, include: { access: { select: { dealId: true, deal: { select: { title: true } } } } } });
  if (!service || !(await mayUse(user, service.access.dealId))) return {};
  await db.$transaction(async (tx) => {
    await deleteOpenTasks(tx, [service.renewalTaskId]);
    await tx.projectService.delete({ where: { id: serviceId } });
  });
  await audit({ actorId: user.id, action: "delete", entity: "ProjectAccess", entityId: service.access.dealId, summary: `Removed ${service.name} from ${service.access.deal.title}` });
  refresh(service.access.dealId);
  return { ok: true };
}

/** "I signed in and checked it": resets the 6-month clock and the reminder. */
export async function markChecked(accessId: string): Promise<Result> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const access = await loadAccess(accessId, user);
  if (!access) return { message: "This project no longer exists." };
  if (!access.googleEmail) return { message: "Add the project's Google account first." };
  const now = new Date();
  await db.$transaction(async (tx) => {
    if (access.reviewTaskId) await tx.activity.updateMany({ where: { id: access.reviewTaskId, completedAt: null }, data: { completedAt: now } });
    const updated = await tx.projectAccess.update({ where: { id: accessId }, data: { lastCheckedAt: now, lastCheckedById: user.id } });
    await syncReviewTask(tx, updated, access.deal, user.id);
  });
  await audit({ actorId: user.id, action: "update", entity: "ProjectAccess", entityId: access.dealId, summary: `Checked project Gmail: ${access.deal.title}` });
  refresh(access.dealId);
  return { ok: true, message: "Thanks. Next check in 6 months." };
}

export async function setChecklistItem(accessId: string, key: AccessChecklistKey, done: boolean): Promise<Result> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  if (!ACCESS_CHECKLIST.some((c) => c.key === key)) return { message: "Unknown checklist item." };
  if (!(await loadAccess(accessId, user))) return { message: "This project no longer exists." };
  const access = await db.projectAccess.update({ where: { id: accessId }, data: { [key]: done }, select: { dealId: true } }).catch(() => null);
  if (!access) return { message: "This project no longer exists." };
  refresh(access.dealId);
  return { ok: true };
}

/** Archive when the project is finished: everything kept, flagged as not in daily use. */
export async function setArchived(accessId: string, archived: boolean): Promise<Result> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const access = await loadAccess(accessId, user);
  if (!access) return { message: "This project no longer exists." };
  if (archived && ACCESS_CHECKLIST.some((c) => !access[c.key])) return { message: "Finish the close-out checklist first." };
  await db.projectAccess.update({ where: { id: accessId }, data: { status: archived ? "ARCHIVED" : "ACTIVE", archivedAt: archived ? new Date() : null } });
  await audit({ actorId: user.id, action: "update", entity: "ProjectAccess", entityId: access.dealId, summary: `${archived ? "Archived" : "Reopened for maintenance"}: ${access.deal.title}` });
  refresh(access.dealId);
  return { ok: true };
}

/**
 * One Project Delivery Pack per project. The first time it gets a number; after that, "Update" refreshes
 * the same pack with today's services and bumps its version, keeping the number the client already has.
 */
export async function createHandover(accessId: string, docs: HandoverDocsChoice = { warranty: false, nda: false }): Promise<{ id?: string; message?: string }> {
  const user = await authorizeAction("access:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const access = await db.projectAccess.findUnique({ where: { id: accessId }, include: accessInclude });
  if (!access || !(await mayUse(user, access.dealId))) return { message: "This project no longer exists." };
  if (!access.services.length && !access.googleEmail) return { message: "Add the project's account or services first." };

  const latest = access.handovers[0];
  const handover = await db.$transaction(async (tx) => {
    if (latest) {
      const version = ((latest.snapshot as unknown as HandoverSnapshot).version ?? 1) + 1;
      const snapshot = { ...(await buildHandoverSnapshot(access, latest.number, user.name, docs)), version };
      return tx.handover.update({ where: { id: latest.id }, data: { issuedAt: new Date(), issuedById: user.id, snapshot } });
    }
    const number = await nextNumber(tx, "DP");
    const snapshot = { ...(await buildHandoverSnapshot(access, number, user.name, docs)), version: 1 };
    return tx.handover.create({ data: { number, accessId, issuedById: user.id, snapshot } });
  });
  const v = (handover.snapshot as unknown as HandoverSnapshot).version ?? 1;
  await audit({
    actorId: user.id,
    action: latest ? "update" : "create",
    entity: "ProjectAccess",
    entityId: access.dealId,
    summary: `Project Delivery Pack ${handover.number}${v > 1 ? ` updated to version ${v}` : ""}: ${access.deal.title}${docs.warranty || docs.nda ? ` (with ${[docs.warranty && "warranty", docs.nda && "NDA"].filter(Boolean).join(" and ")})` : ""}`,
  });
  refresh(access.dealId);
  return { id: handover.id };
}

export async function deleteAccess(accessId: string): Promise<Result> {
  const user = await authorizeAction("access:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const access = await db.projectAccess.findUnique({ where: { id: accessId }, include: { services: { select: { renewalTaskId: true } }, deal: { select: { title: true } } } });
  if (!access || !(await mayUse(user, access.dealId))) return {};
  await db.$transaction(async (tx) => {
    await deleteOpenTasks(tx, [access.reviewTaskId, ...access.services.map((s) => s.renewalTaskId)]);
    await tx.projectAccess.delete({ where: { id: accessId } });
  });
  await audit({ actorId: user.id, action: "delete", entity: "ProjectAccess", entityId: access.dealId, summary: `Project access removed: ${access.deal.title}` });
  refresh(access.dealId);
  return { ok: true };
}
