import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { getAssignableOwners, getVisibility } from "@/lib/visibility";
import { financeMonthKey, financeMonths, splitPayment, type FinancePeriod } from "@/lib/finance-math";

const n = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Whose money a person sees on the Income page, its PDF and CSV, using the same rules as invoices:
 * Sales their own deals' invoices, a Manager theirs and their team's, an Admin everything.
 * `person` narrows to one person the viewer may see. Commission lines follow the same people.
 */
export async function financeScope(viewer: { id: string; role: Role }, personParam?: string | null) {
  const [v, people] = await Promise.all([getVisibility(viewer), getAssignableOwners(viewer)]);
  const person = personParam ? people.find((p) => p.id === personParam) : undefined;
  const mine = (id: string): Prisma.InvoiceWhereInput => ({ OR: [{ deal: { ownerId: id } }, { createdById: id }, { contract: { ownerId: id } }] });
  const invoice: Prisma.InvoiceWhereInput = person ? { AND: [v.invoice, mine(person.id)] } : v.invoice;
  const commissionUsers = person ? [person.id] : v.ids; // null = everyone
  const label = person ? person.name : v.ids === null ? "Whole company" : v.ids.length === 1 ? "Your sales" : "You and your team";
  return { invoice, commissionUsers, person, people, label, all: v.ids === null };
}
export type FinanceScope = Awaited<ReturnType<typeof financeScope>>;

/** Payments received in the period that this scope may see, with their invoice and the commission on them. */
export function paymentsIn(period: FinancePeriod, scope: FinanceScope) {
  return db.payment.findMany({
    where: { paidAt: { gte: period.from, lt: period.to }, invoice: scope.invoice },
    orderBy: { paidAt: "asc" },
    include: {
      invoice: { select: { id: true, number: true, title: true, currency: true, total: true, taxTotal: true, taxLabel: true, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } },
      commissions: {
        where: scope.commissionUsers ? { userId: { in: scope.commissionUsers } } : {},
        select: { amount: true, percent: true, base: true, role: true, paidAt: true, user: { select: { id: true, name: true } } },
      },
    },
  });
}
export type IncomePayment = Awaited<ReturnType<typeof paymentsIn>>[number];

/**
 * Everything on the Income page and its PDF, in rupees. Income is cash received (payments by the date they
 * arrived), without VAT, which belongs to the government. Commission by the date the client paid.
 * Expenses, profit and tax are the accountant's: they need the full books.
 */
export async function incomeSummary(period: FinancePeriod, scope: FinanceScope) {
  const payments = await paymentsIn(period, scope);
  const months = financeMonths(period).map((m) => ({ ...m, local: 0, export: 0, vat: 0, commissions: 0 }));
  const month = (d: Date) => months.find((m) => m.key === financeMonthKey(d));
  const byPerson = new Map<string, { name: string; earned: number; paid: number }>();
  let localIncome = 0;
  let exportIncome = 0;
  let vat = 0;
  let commissions = 0;
  const missingLkr: { id: string; invoiceId: string; receipt: string; amount: string; currency: string }[] = [];
  const lines: { p: IncomePayment; split: ReturnType<typeof splitPayment> }[] = [];

  for (const p of payments) {
    const split = splitPayment({ amount: n(p.amount), amountLkr: p.amountLkr == null ? null : n(p.amountLkr), currency: p.invoice.currency, invoiceTotal: n(p.invoice.total), invoiceTax: n(p.invoice.taxTotal) });
    lines.push({ p, split });
    let c = 0;
    for (const x of p.commissions) {
      c += n(x.amount);
      const row = byPerson.get(x.user.id) ?? { name: x.user.name, earned: 0, paid: 0 };
      row.earned += n(x.amount);
      if (x.paidAt) row.paid += n(x.amount);
      byPerson.set(x.user.id, row);
    }
    commissions += c;
    const m = month(p.paidAt);
    if (m) m.commissions += c;
    if (!split) {
      missingLkr.push({ id: p.id, invoiceId: p.invoice.id, receipt: p.receiptNumber, amount: p.amount.toString(), currency: p.invoice.currency });
      continue;
    }
    if (split.foreign) exportIncome += split.net;
    else localIncome += split.net;
    vat += split.vat;
    if (m) {
      if (split.foreign) m.export += split.net;
      else m.local += split.net;
      m.vat += split.vat;
    }
  }

  return {
    localIncome: round2(localIncome),
    exportIncome: round2(exportIncome),
    income: round2(localIncome + exportIncome),
    vat: round2(vat),
    commissions: round2(commissions),
    months,
    lines,
    commissionByPerson: [...byPerson.values()].map((r) => ({ ...r, earned: round2(r.earned), paid: round2(r.paid) })).sort((a, b) => b.earned - a.earned),
    paymentCount: payments.length,
    missingLkr,
  };
}
export type IncomeSummary = Awaited<ReturnType<typeof incomeSummary>>;
