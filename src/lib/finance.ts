import "server-only";
import { db } from "@/lib/db";
import { estimateTax, financeMonthKey, financeMonths, splitPayment, type FinancePeriod } from "@/lib/finance-math";

const n = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Payments received in the period, with their invoice, for the Income & tax page and the accountant export. */
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
 * Everything on the Income & tax page, in rupees. Income is cash received (payments by the date they
 * arrived), without VAT, which belongs to the government. Expenses by the date paid. Commission by the
 * date the client paid, since that's when it was earned.
 */
export async function financeSummary(period: FinancePeriod, rates: { incomeTaxPercent: { toString(): string }; exportIncomeTaxPercent: { toString(): string } }) {
  const [payments, expenses, byCategory] = await Promise.all([
    paymentsIn(period),
    db.expense.findMany({ where: { date: { gte: period.from, lt: period.to } }, select: { date: true, amount: true } }),
    db.expense.groupBy({ by: ["category"], where: { date: { gte: period.from, lt: period.to } }, _sum: { amount: true } }),
  ]);

  const months = financeMonths(period).map((m) => ({ ...m, income: 0, expenses: 0, commissions: 0, profit: 0 }));
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
    if (m) m.income += split.net;
  }
  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += n(e.amount);
    const m = month(e.date);
    if (m) m.expenses += n(e.amount);
  }
  for (const m of months) m.profit = round2(m.income - m.expenses - m.commissions);

  const estimate = estimateTax({ localIncome, exportIncome, expenses: expenseTotal, commissions, rate: n(rates.incomeTaxPercent), exportRate: n(rates.exportIncomeTaxPercent) });
  return {
    localIncome: round2(localIncome),
    exportIncome: round2(exportIncome),
    income: round2(localIncome + exportIncome),
    vat: round2(vat),
    expenses: round2(expenseTotal),
    commissions: round2(commissions),
    byCategory: byCategory.map((r) => ({ category: r.category, total: n(r._sum.amount) })).sort((a, b) => b.total - a.total),
    months,
    paymentCount: payments.length,
    missingLkr,
    ...estimate,
  };
}
