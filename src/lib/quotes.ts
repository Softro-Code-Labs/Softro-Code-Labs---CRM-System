import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { quoteTotals } from "@/lib/quote-math";
import { nextNumber } from "@/lib/numbering";
import type { QuoteInput } from "@/lib/validation/quote";
import { sealSelect } from "@/lib/seal";

/** Next quote number for the year, e.g. Q-2026-0007. */
export function nextQuoteNumber(tx: Prisma.TransactionClient, date = new Date()) {
  return nextNumber(tx, "Q", date);
}

/** Turns validated input into the rows and totals we store. */
export function buildQuoteData(input: QuoteInput) {
  const totals = quoteTotals(input.items, input.discountPercent, input.taxRate);
  const items = input.items.map((item, position) => ({ ...item, position, lineTotal: totals.lineTotals[position] }));
  return {
    quote: {
      title: input.title,
      currency: input.currency,
      issueDate: input.issueDate!,
      validUntil: input.validUntil,
      dealId: input.dealId,
      companyId: input.companyId,
      contactId: input.contactId,
      introduction: input.introduction,
      terms: input.terms,
      notes: input.notes,
      discountPercent: input.discountPercent,
      taxLabel: input.taxLabel,
      taxRate: input.taxRate,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
    },
    items,
  };
}

/** A quote that's been sent but has passed its valid-until date. */
export function isExpired(q: { status: string; validUntil: Date | null }, now = new Date()) {
  return q.status === "SENT" && q.validUntil !== null && q.validUntil.getTime() + 86_400_000 < now.getTime();
}

export const quoteInclude = {
  items: { orderBy: { position: "asc" } },
  company: { select: { id: true, name: true, addressLine: true, city: true, country: true, email: true, phone: true, taxId: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true } },
  deal: { select: { id: true, title: true, status: true } },
  createdBy: { select: { name: true, email: true, phone: true, jobTitle: true } },
  seal: { select: sealSelect },
} satisfies Prisma.QuoteInclude;

export type FullQuote = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

export async function getQuote(id: string) {
  return db.quote.findUnique({ where: { id }, include: quoteInclude });
}
