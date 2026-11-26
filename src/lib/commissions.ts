import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { commissionSplits, splitPayment } from "@/lib/finance-math";

const n = (v: { toString(): string } | number | null | undefined) => (v == null ? 0 : Number(v.toString()));

export function commissionRates(org: { commissionSalesPercent: { toString(): string }; commissionManagerPercent: { toString(): string }; commissionLeaderPercent: { toString(): string } }) {
  return { sales: n(org.commissionSalesPercent), manager: n(org.commissionManagerPercent), leader: n(org.commissionLeaderPercent) };
}

/**
 * Records the commission earned on one payment, inside the payment's transaction.
 * Only project invoices count (made for a deal, not a maintenance or hosting contract's regular fee),
 * on what the client paid without VAT, in rupees. Returns a note when something stopped it.
 */
export async function recordCommissions(
  tx: Prisma.TransactionClient,
  payment: { id: string; amount: number; amountLkr: number | null },
  invoice: { dealId: string | null; contractId: string | null; currency: string; total: { toString(): string }; taxTotal: { toString(): string } },
): Promise<string | null> {
  if (!invoice.dealId || invoice.contractId) return null;
  const deal = await tx.deal.findUnique({ where: { id: invoice.dealId }, select: { owner: { select: { id: true, role: true, managerId: true, name: true } } } });
  const owner = deal?.owner;
  if (!owner) return "No commission: the deal has no owner.";
  const split = splitPayment({ amount: payment.amount, amountLkr: payment.amountLkr, currency: invoice.currency, invoiceTotal: n(invoice.total), invoiceTax: n(invoice.taxTotal) });
  if (!split) return null;
  const org = await tx.orgSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const rows = commissionSplits(split.net, owner, commissionRates(org));
  if (rows.length) await tx.commission.createMany({ data: rows.map((r) => ({ paymentId: payment.id, userId: r.userId, role: r.role, percent: r.percent, base: split.net, amount: r.amount })) });
  if (owner.role !== "ADMIN" && owner.role !== "MANAGER" && !owner.managerId) return `${owner.name} has no manager, so no manager's commission was added.`;
  return null;
}
