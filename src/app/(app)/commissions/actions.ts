"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { PAYMENTS_WITHOUT_COMMISSION, recordCommissions } from "@/lib/commissions";

/**
 * Admins mark commission paid once the money has gone to the person (with their salary, usually).
 * Marking unpaid undoes a mistake, and is needed before the payment it came from can be cancelled.
 */
export async function setCommissionsPaid(ids: string[], paid: boolean): Promise<{ message?: string }> {
  const user = await authorizeAction("commission:pay");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  if (!ids.length || ids.length > 1000) return {};
  const rows = await db.commission.findMany({ where: { id: { in: ids }, paidAt: paid ? null : { not: null } }, select: { id: true, amount: true } });
  if (!rows.length) return {};
  await db.commission.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: paid ? { paidAt: new Date(), paidById: user.id } : { paidAt: null, paidById: null } });
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  await audit({ actorId: user.id, action: "update", entity: "Commission", summary: `Marked ${rows.length} commission ${rows.length === 1 ? "line" : "lines"} ${paid ? "paid" : "unpaid"} (${formatMoney(total, "LKR")})`, meta: { ids: rows.map((r) => r.id) } });
  revalidatePath("/commissions");
  return {};
}

/**
 * One-off catch-up for payments recorded before commission existed (or missed): adds the commission each
 * should have earned, at today's rates and deal owner. Payments that already have commission are skipped,
 * so running it twice adds nothing.
 */
export async function addMissingCommissions(): Promise<{ message?: string }> {
  const user = await authorizeAction("commission:pay");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const payments = await db.payment.findMany({
    where: PAYMENTS_WITHOUT_COMMISSION,
    take: 500,
    select: { id: true, amount: true, amountLkr: true, invoice: { select: { dealId: true, contractId: true, currency: true, total: true, taxTotal: true } } },
  });
  let added = 0;
  let total = 0;
  for (const p of payments) {
    await db.$transaction(async (tx) => {
      await recordCommissions(tx, { id: p.id, amount: Number(p.amount), amountLkr: p.amountLkr == null ? null : Number(p.amountLkr) }, p.invoice);
    });
    const rows = await db.commission.findMany({ where: { paymentId: p.id }, select: { amount: true } });
    if (rows.length) {
      added++;
      total += rows.reduce((s, r) => s + Number(r.amount), 0);
    }
  }
  if (added) await audit({ actorId: user.id, action: "create", entity: "Commission", summary: `Added missing commission for ${added} past ${added === 1 ? "payment" : "payments"} (${formatMoney(total, "LKR")})` });
  revalidatePath("/commissions");
  revalidatePath("/finance");
  const skipped = payments.length - added;
  if (!added) return { message: skipped ? "No commission could be added: those payments need a rupee amount or a deal owner." : "Nothing missing." };
  return {};
}
