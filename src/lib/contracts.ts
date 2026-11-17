import "server-only";
import type { BillingCycle, ContractStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const DAY = 86_400_000;

/** What a contract is worth per month, for the "monthly recurring" total. */
export function monthlyValue(amount: number | { toString(): string }, cycle: BillingCycle) {
  const a = Number(amount.toString());
  return cycle === "MONTHLY" ? a : cycle === "QUARTERLY" ? a / 3 : cycle === "YEARLY" ? a / 12 : 0;
}

export type ContractState = "active" | "renew-soon" | "past-end" | "paused" | "ended" | "cancelled";

/** Where a contract stands today, including "renew soon" and "past its end date". */
export function contractState(c: { status: ContractStatus; endDate: Date | null; renewalNoticeDays: number }, now = new Date()): ContractState {
  if (c.status === "ENDED") return "ended";
  if (c.status === "CANCELLED") return "cancelled";
  if (c.status === "PAUSED") return "paused";
  if (c.endDate && c.endDate < now) return "past-end";
  if (c.endDate && c.endDate.getTime() - c.renewalNoticeDays * DAY <= now.getTime()) return "renew-soon";
  return "active";
}

export function daysUntil(date: Date, now = new Date()) {
  return Math.ceil((date.getTime() - now.getTime()) / DAY);
}

/** The next period after `end`, the same length as the current one. */
export function nextPeriod(start: Date, end: Date) {
  const length = end.getTime() - start.getTime();
  return { start: end, end: new Date(end.getTime() + length) };
}

/**
 * Keeps one open "renew this contract" task per contract, due `renewalNoticeDays`
 * before the end date and assigned to the contract owner. Removes it if the
 * contract no longer needs renewing.
 */
export async function syncRenewalTask(
  tx: Prisma.TransactionClient,
  contract: { id: string; number: string; title: string; status: ContractStatus; endDate: Date | null; renewalNoticeDays: number; ownerId: string | null; companyId: string; contactId: string | null; renewalTaskId: string | null },
  actorId: string,
) {
  const existing = contract.renewalTaskId ? await tx.activity.findUnique({ where: { id: contract.renewalTaskId } }) : null;
  const needsTask = contract.status === "ACTIVE" && contract.endDate !== null;

  if (!needsTask) {
    if (existing && !existing.completedAt) await tx.activity.delete({ where: { id: existing.id } });
    if (contract.renewalTaskId) await tx.contract.update({ where: { id: contract.id }, data: { renewalTaskId: null } });
    return;
  }

  const dueAt = new Date(Math.max(contract.endDate!.getTime() - contract.renewalNoticeDays * DAY, Date.now()));
  const data = {
    type: "TASK" as const,
    subject: `Renew contract ${contract.number}: ${contract.title}`,
    description: `Contact the client about renewing before ${contract.endDate!.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" })}. Then use "Renew" on the contract.`,
    priority: "HIGH" as const,
    dueAt,
    assignedToId: contract.ownerId ?? actorId,
    companyId: contract.companyId,
    contactId: contract.contactId,
  };
  if (existing && !existing.completedAt) {
    await tx.activity.update({ where: { id: existing.id }, data });
  } else if (!existing) {
    const task = await tx.activity.create({ data: { ...data, createdById: actorId } });
    await tx.contract.update({ where: { id: contract.id }, data: { renewalTaskId: task.id } });
  }
}

export const contractInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true } },
  deal: { select: { id: true, title: true } },
  owner: { select: { name: true } },
  renewedFrom: { select: { id: true, number: true } },
  renewedTo: { select: { id: true, number: true } },
} satisfies Prisma.ContractInclude;

export async function getContract(id: string) {
  return db.contract.findUnique({ where: { id }, include: contractInclude });
}
