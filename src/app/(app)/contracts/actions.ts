"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { nextNumber } from "@/lib/numbering";
import { nextPeriod, syncRenewalTask } from "@/lib/contracts";
import { contractSchema, type ContractInput } from "@/lib/validation/contract";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import type { ContractStatus } from "@/generated/prisma/enums";

function refresh(c: { id: string; companyId: string; dealId: string | null }) {
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${c.id}`);
  revalidatePath(`/companies/${c.companyId}`);
  revalidatePath("/dashboard");
  revalidatePath("/activities");
  if (c.dealId) revalidatePath(`/deals/${c.dealId}`);
}

async function checkLinks(data: ContractInput): Promise<Record<string, string[]> | null> {
  const [company, contact, deal] = await Promise.all([
    db.company.findUnique({ where: { id: data.companyId }, select: { id: true } }),
    data.contactId ? db.contact.findUnique({ where: { id: data.contactId }, select: { companyId: true } }) : null,
    data.dealId ? db.deal.findUnique({ where: { id: data.dealId }, select: { companyId: true } }) : null,
  ]);
  if (!company) return { companyId: ["That company no longer exists."] };
  if (data.contactId && (!contact || (contact.companyId && contact.companyId !== data.companyId))) return { contactId: ["Pick a contact at this company."] };
  if (data.dealId && (!deal || (deal.companyId && deal.companyId !== data.companyId))) return { dealId: ["Pick a deal for this company."] };
  return null;
}

export async function saveContract(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("contract:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = contractSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const linkErrors = await checkLinks(parsed.data);
  if (linkErrors) return { errors: linkErrors, values, message: Object.values(linkErrors)[0]?.[0] };

  const data = { ...parsed.data, startDate: parsed.data.startDate!, ownerId: parsed.data.ownerId ?? user.id };

  const contract = await db.$transaction(async (tx) => {
    const saved = id
      ? await tx.contract.update({ where: { id }, data })
      : await tx.contract.create({ data: { ...data, number: await nextNumber(tx, "C") } });
    await syncRenewalTask(tx, saved, user.id);
    return saved;
  });
  await audit({ actorId: user.id, action: id ? "update" : "create", entity: "Contract", entityId: contract.id, summary: `${contract.number} ${contract.title}` });
  refresh(contract);
  redirect(`/contracts/${contract.id}`);
}

export async function setContractStatus(id: string, status: Exclude<ContractStatus, "ENDED">): Promise<{ message?: string }> {
  const user = await authorizeAction("contract:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const existing = await db.contract.findUnique({ where: { id } });
  if (!existing) return { message: "This contract no longer exists." };
  if (existing.status === "ENDED") return { message: "This contract has ended. Renew it or create a new one." };

  const contract = await db.$transaction(async (tx) => {
    const saved = await tx.contract.update({ where: { id }, data: { status, endedAt: status === "CANCELLED" ? new Date() : null } });
    await syncRenewalTask(tx, saved, user.id);
    return saved;
  });
  await audit({ actorId: user.id, action: "update", entity: "Contract", entityId: id, summary: `${contract.number}: ${existing.status} → ${status}` });
  refresh(contract);
  return {};
}

/** Starts the next period: a new contract with the same terms; this one becomes Ended. */
export async function renewContract(id: string) {
  const user = await authorizeAction("contract:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const old = await db.contract.findUnique({ where: { id }, include: { renewedTo: { select: { id: true } } } });
  if (!old) return { message: "This contract no longer exists." };
  if (old.renewedTo) return { message: "This contract was already renewed." };
  if (!old.endDate) return { message: "Open-ended contracts don't need renewing. Add an end date first." };

  const period = nextPeriod(old.startDate, old.endDate);
  const renewed = await db.$transaction(async (tx) => {
    // The renewal task has done its job.
    if (old.renewalTaskId) await tx.activity.updateMany({ where: { id: old.renewalTaskId, completedAt: null }, data: { completedAt: new Date() } });
    await tx.contract.update({ where: { id }, data: { status: "ENDED", endedAt: new Date(), renewalTaskId: null } });
    const next = await tx.contract.create({
      data: {
        number: await nextNumber(tx, "C"),
        title: old.title,
        type: old.type,
        companyId: old.companyId,
        contactId: old.contactId,
        dealId: old.dealId,
        ownerId: old.ownerId,
        startDate: period.start,
        endDate: period.end,
        billingCycle: old.billingCycle,
        amount: old.amount,
        currency: old.currency,
        autoRenew: old.autoRenew,
        renewalNoticeDays: old.renewalNoticeDays,
        responseTimeHours: old.responseTimeHours,
        includedHours: old.includedHours,
        scope: old.scope,
        renewedFromId: old.id,
      },
    });
    // Open tickets carry over to the new period.
    await tx.ticket.updateMany({ where: { contractId: old.id, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] } }, data: { contractId: next.id } });
    await syncRenewalTask(tx, next, user.id);
    return next;
  });
  await audit({ actorId: user.id, action: "create", entity: "Contract", entityId: renewed.id, summary: `${renewed.number}: renewal of ${old.number}` });
  refresh(old);
  refresh(renewed);
  redirect(`/contracts/${renewed.id}/edit?renewed=1`);
}

export async function deleteContract(id: string) {
  const user = await authorizeAction("contract:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const contract = await db.contract.findUnique({ where: { id } });
  if (!contract) return { message: "This contract no longer exists." };
  await db.$transaction(async (tx) => {
    if (contract.renewalTaskId) await tx.activity.deleteMany({ where: { id: contract.renewalTaskId, completedAt: null } });
    await tx.contract.delete({ where: { id } });
  });
  await audit({ actorId: user.id, action: "delete", entity: "Contract", entityId: id, summary: `${contract.number} ${contract.title}` });
  refresh(contract);
  redirect(`/companies/${contract.companyId}`);
}
