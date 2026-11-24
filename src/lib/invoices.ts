import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { quoteTotals, type LineInput } from "@/lib/quote-math";
import type { InvoiceInput } from "@/lib/validation/invoice";
import { BILLING_CYCLE_LABELS } from "@/lib/crm-meta";
import { sealSelect } from "@/lib/seal";

const DAY = 86_400_000;
const n = (v: { toString(): string } | number | null | undefined) => (v == null ? 0 : Number(v.toString()));
const round2 = (v: number) => Math.round(v * 100) / 100;

export const invoiceInclude = {
  items: { orderBy: { position: "asc" } },
  company: { select: { id: true, name: true, addressLine: true, city: true, country: true, email: true, phone: true, taxId: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true } },
  deal: { select: { id: true, title: true, ownerId: true } },
  quote: { select: { id: true, number: true, title: true, total: true } },
  contract: { select: { id: true, number: true, title: true } },
  createdBy: { select: { name: true, email: true, phone: true } },
  payments: { orderBy: { paidAt: "asc" }, include: { recordedBy: { select: { name: true } }, seal: { select: { signerName: true, sealedAt: true } } } },
  seal: { select: sealSelect },
} satisfies Prisma.InvoiceInclude;

export type FullInvoice = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function getInvoice(id: string) {
  return db.invoice.findUnique({ where: { id }, include: invoiceInclude });
}

export const balanceDue = (inv: { total: { toString(): string }; amountPaid: { toString(): string } }) => round2(n(inv.total) - n(inv.amountPaid));

/** Where an invoice stands, for badges and lists. */
export function invoiceState(inv: { status: string; dueDate: Date | null; total: { toString(): string }; amountPaid: { toString(): string } }, now = new Date()) {
  if (inv.status === "VOID") return "void" as const;
  if (inv.status === "PAID" || balanceDue(inv) <= 0) return "paid" as const;
  if (inv.dueDate && inv.dueDate.getTime() + DAY <= now.getTime()) return "overdue" as const;
  if (n(inv.amountPaid) > 0) return "part-paid" as const;
  if (inv.dueDate && inv.dueDate.getTime() - now.getTime() < 3 * DAY) return "due-soon" as const;
  return "unpaid" as const;
}

/** Can still be edited: issued and nothing paid yet. */
export const isEditable = (inv: { status: string; amountPaid: { toString(): string } }) => inv.status === "ISSUED" && n(inv.amountPaid) === 0;

/** Rows and totals to store, from validated editor input. */
export function buildInvoiceData(input: InvoiceInput) {
  const totals = quoteTotals(input.items, input.discountPercent, input.taxRate);
  return {
    invoice: {
      title: input.title,
      currency: input.currency,
      issueDate: input.issueDate!,
      dueDate: input.dueDate,
      dealId: input.dealId,
      companyId: input.companyId,
      contactId: input.contactId,
      contractId: input.contractId,
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
    items: input.items.map((item, position) => ({
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      position,
      lineTotal: totals.lineTotals[position],
    })),
  };
}

type Line = { title: string; description: string | null; quantity: number; unit: string; unitPrice: number; discountPercent: number };

function totalsFor(lines: Line[], discountPercent: number, taxRate: number) {
  const t = quoteTotals(lines as LineInput[], discountPercent, taxRate);
  return { totals: t, items: lines.map((l, position) => ({ ...l, position, lineTotal: t.lineTotals[position] })) };
}

export type FromQuoteMode = "full" | "percent" | "balance";

/** Net (after discount, before tax) already invoiced for a quote, ignoring void invoices. */
export async function invoicedNetForQuote(quoteId: string, tx: Prisma.TransactionClient = db) {
  const rows = await tx.invoice.findMany({ where: { quoteId, status: { not: "VOID" } }, select: { subtotal: true, discountTotal: true } });
  return round2(rows.reduce((s, r) => s + n(r.subtotal) - n(r.discountTotal), 0));
}

/**
 * Invoice lines for an accepted quote: the whole quote, a percentage (advance), or what's left (balance).
 * VAT is charged at the quote's rate on each invoice, so advance + balance add up to the quote total.
 */
export async function linesFromQuote(
  quote: Prisma.QuoteGetPayload<{ include: { items: true } }>,
  mode: FromQuoteMode,
  percent: number,
  tx: Prisma.TransactionClient = db,
) {
  const quoteNet = round2(n(quote.subtotal) - n(quote.discountTotal));
  const already = await invoicedNetForQuote(quote.id, tx);
  if (mode === "full") {
    if (already > 0) throw new Error("Part of this quote is already invoiced. Use “Balance” instead.");
    return totalsFor(
      quote.items.map((i) => ({ title: i.title, description: i.description, quantity: n(i.quantity), unit: i.unit, unitPrice: n(i.unitPrice), discountPercent: n(i.discountPercent) })),
      n(quote.discountPercent),
      n(quote.taxRate),
    );
  }
  const amount = mode === "percent" ? round2((quoteNet * percent) / 100) : round2(quoteNet - already);
  if (amount <= 0) throw new Error("This quote is already fully invoiced.");
  if (mode === "percent" && round2(already + amount) > quoteNet + 0.01) throw new Error(`That's more than what's left to invoice on this quote.`);
  const title = mode === "percent" ? `${already > 0 ? "Part" : "Advance"} payment (${percent}%)` : already > 0 ? "Balance payment" : "Payment";
  return totalsFor(
    [{ title, description: `${quote.number}: ${quote.title}`, quantity: 1, unit: "item", unitPrice: amount, discountPercent: 0 }],
    0,
    n(quote.taxRate),
  );
}

/** One line for a contract's fee: "Website maintenance, monthly fee (Nov 2026)". */
export function linesFromContract(
  contract: { number: string; title: string; amount: { toString(): string }; billingCycle: keyof typeof BILLING_CYCLE_LABELS },
  taxRate: number,
  forDate = new Date(),
) {
  const month = forDate.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "Asia/Colombo" });
  return totalsFor(
    [
      {
        title: `${contract.title}, ${BILLING_CYCLE_LABELS[contract.billingCycle].toLowerCase()} fee`,
        description: `${contract.number} · from ${month}`,
        quantity: 1,
        unit: "item",
        unitPrice: n(contract.amount),
        discountPercent: 0,
      },
    ],
    0,
    taxRate,
  );
}

/** Keeps one open "chase payment" task per unpaid invoice, due the day after it's due. Closed when paid or voided. */
export async function syncFollowUpTask(
  tx: Prisma.TransactionClient,
  inv: { id: string; number: string; title: string; status: string; dueDate: Date | null; issueDate: Date; total: { toString(): string }; amountPaid: { toString(): string }; currency: string; dealId: string | null; companyId: string | null; contactId: string | null; followUpTaskId: string | null; createdById: string | null },
  ownerId: string | null,
) {
  const existing = inv.followUpTaskId ? await tx.activity.findUnique({ where: { id: inv.followUpTaskId } }) : null;
  const open = inv.status === "ISSUED" && balanceDue(inv) > 0;
  if (!open) {
    if (existing && !existing.completedAt) await tx.activity.update({ where: { id: existing.id }, data: { completedAt: new Date() } });
    return;
  }
  const due = new Date((inv.dueDate ?? new Date(inv.issueDate.getTime() + 14 * DAY)).getTime() + DAY);
  const data = {
    type: "TASK" as const,
    subject: `Follow up payment: ${inv.number}`,
    description: `${inv.title}. Balance ${inv.currency} ${balanceDue(inv).toLocaleString("en-LK", { minimumFractionDigits: 2 })}. Call or WhatsApp the client if it hasn't arrived.`,
    priority: "HIGH" as const,
    dueAt: due,
    assignedToId: ownerId ?? inv.createdById,
    dealId: inv.dealId,
    companyId: inv.companyId,
    contactId: inv.contactId,
  };
  if (existing && !existing.completedAt) await tx.activity.update({ where: { id: existing.id }, data });
  else {
    const task = await tx.activity.create({ data: { ...data, createdById: inv.createdById } });
    await tx.invoice.update({ where: { id: inv.id }, data: { followUpTaskId: task.id } });
  }
}
