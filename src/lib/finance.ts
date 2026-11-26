import "server-only";
import { db } from "@/lib/db";
import { financeMonthKey, financeMonths, splitPayment, type FinancePeriod } from "@/lib/finance-math";

const n = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Payments received in the period, with their invoice, for the Income page and the accountant export. */
export function paymentsIn(period: FinancePeriod) {
  return db.payment.findMany({
    where: { paidAt: { gte: period.from, lt: period.to } },
    orderBy: { paidAt: "asc" },
    include: {
      invoice: { select: { id: true, number: true, title: true, currency: true, total: true, taxTotal: true, taxLabel: true, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } } },
      commissions: { select: { amount: true } },
    },
  });
}

/**
 * Everything on the Income page, in rupees. Income is cash received (payments by the date they arrived),
 * without VAT, which belongs to the government. Commission by the date the client paid.
 * Expenses, profit and tax are the accountant's: they need the full books.
 */
export async function incomeSummary(period: FinancePeriod) {
  const payments = await paymentsIn(period);
  const months = financeMonths(period).map((m) => ({ ...m, local: 0, export: 0, vat: 0, commissions: 0 }));
  const month = (d: Date) => months.find((m) => m.key === financeMonthKey(d));
  let localIncome = 0;
  let exportIncome = 0;
  let vat = 0;
  let commissions = 0;
  const missingLkr: { id: string; invoiceId: string; receipt: string; amount: string; currency: string }[] = [];

  for (const p of payments) {
    const split = splitPayment({ amount: n(p.amount), amountLkr: p.amountLkr == null ? null : n(p.amountLkr), currency: p.invoice.currency, invoiceTotal: n(p.invoice.total), invoiceTax: n(p.invoice.taxTotal) });
    const c = p.commissions.reduce((s, x) => s + n(x.amount), 0);
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
    paymentCount: payments.length,
    missingLkr,
  };
}
