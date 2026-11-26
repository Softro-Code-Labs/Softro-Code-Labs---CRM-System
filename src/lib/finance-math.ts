/**
 * Pure maths for the Income & tax page and sales commissions. No database, so it's unit-tested.
 * Sri Lanka's tax year (year of assessment) runs 1 April – 31 March, and dates are in Colombo time.
 */

const OFFSET = 5.5 * 60 * 60 * 1000;
const DAY = 86_400_000;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Midnight in Colombo at the start of a local date; month may overflow. */
function colombo(y: number, m: number, d = 1) {
  return new Date(Date.UTC(y, m, d) - OFFSET);
}
function local(date: Date) {
  const l = new Date(date.getTime() + OFFSET);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth() };
}

// ─── Periods ──────────────────────────────────────────────────────────────────

export type FinancePeriod = { key: string; from: Date; to: Date; label: string };

/** First year of the tax year a date falls in: Nov 2026 → 2026 (2026/27), Feb 2027 → 2026. */
export function taxYearOf(date: Date) {
  const { y, m } = local(date);
  return m >= 3 ? y : y - 1;
}
const yearLabel = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
const QUARTERS = ["Apr–Jun", "Jul–Sep", "Oct–Dec", "Jan–Mar"];

/** Presets for the period picker on the finance pages. */
export function financePeriodOptions(now = new Date()) {
  const ty = taxYearOf(now);
  return [
    { value: "this-tax-year", label: `Tax year ${yearLabel(ty)} (Apr–Mar)` },
    { value: "last-tax-year", label: `Tax year ${yearLabel(ty - 1)}` },
    ...QUARTERS.map((q, i) => ({ value: `q${i + 1}`, label: `${q} ${i === 3 ? ty + 1 : ty} (quarter ${i + 1} of ${yearLabel(ty)})` })),
    { value: "this-month", label: "This month" },
    { value: "last-month", label: "Last month" },
  ];
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = colombo(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" });

/** Reads ?period= or ?from=&to= (yyyy-mm-dd, both days included). Defaults to the current tax year. `to` is exclusive. */
export function resolveFinancePeriod(params: { period?: string; from?: string; to?: string }, now = new Date()): FinancePeriod {
  const from = parseDay(params.from);
  const toDay = parseDay(params.to);
  if (from && toDay && toDay >= from) return { key: "custom", from, to: new Date(toDay.getTime() + DAY), label: `${dayFmt.format(from)} – ${dayFmt.format(toDay)}` };

  const ty = taxYearOf(now);
  const { y, m } = local(now);
  const ranges: Record<string, [Date, Date]> = {
    "this-tax-year": [colombo(ty, 3), colombo(ty + 1, 3)],
    "last-tax-year": [colombo(ty - 1, 3), colombo(ty, 3)],
    q1: [colombo(ty, 3), colombo(ty, 6)],
    q2: [colombo(ty, 6), colombo(ty, 9)],
    q3: [colombo(ty, 9), colombo(ty, 12)],
    q4: [colombo(ty + 1, 0), colombo(ty + 1, 3)],
    "this-month": [colombo(y, m), colombo(y, m + 1)],
    "last-month": [colombo(y, m - 1), colombo(y, m)],
  };
  const options = financePeriodOptions(now);
  const key = ranges[params.period ?? ""] ? params.period! : "this-tax-year";
  const [f, t] = ranges[key];
  return { key, from: f, to: t, label: options.find((o) => o.value === key)!.label };
}

/** One bucket per calendar month the period touches (capped at 24). */
export function financeMonths(period: { from: Date; to: Date }) {
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  let { y, m } = local(period.from);
  const fmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "Asia/Colombo" });
  while (out.length < 24) {
    const start = colombo(y, m);
    if (start >= period.to) break;
    out.push({ key: `${y}-${m}`, label: fmt.format(start), start, end: colombo(y, m + 1) });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}
export function financeMonthKey(date: Date) {
  const { y, m } = local(date);
  return `${y}-${m}`;
}

// ─── Payments: income and VAT ─────────────────────────────────────────────────

/**
 * Splits a payment into income and VAT, in rupees. A part payment carries the same share of VAT as the
 * invoice. `lkr` is null when a foreign-currency payment has no rupee amount recorded yet.
 */
export function splitPayment(p: { amount: number; amountLkr: number | null; currency: string; invoiceTotal: number; invoiceTax: number }) {
  const lkr = p.currency === "LKR" ? p.amount : p.amountLkr;
  if (lkr == null) return null;
  const vatShare = p.invoiceTotal > 0 ? p.invoiceTax / p.invoiceTotal : 0;
  const vat = round2(lkr * vatShare);
  return { received: round2(lkr), vat, net: round2(lkr - vat), foreign: p.currency !== "LKR" };
}

// ─── Commission ───────────────────────────────────────────────────────────────

export type CommissionRates = { sales: number; manager: number; leader: number };

/**
 * Who earns what on money received for a deal.
 * Deal owner who is a Manager or Admin → the leader rate (20%).
 * Anyone else → the sales rate (16%) for them, and the manager rate (4%) for their manager, if they have one.
 */
export function commissionSplits(
  base: number,
  owner: { id: string; role: string; managerId: string | null },
  rates: CommissionRates,
): { userId: string; role: "SELLER" | "MANAGER"; percent: number; amount: number }[] {
  if (!(base > 0)) return [];
  const leads = owner.role === "ADMIN" || owner.role === "MANAGER";
  const rows: { userId: string; role: "SELLER" | "MANAGER"; percent: number }[] = [{ userId: owner.id, role: "SELLER", percent: leads ? rates.leader : rates.sales }];
  if (!leads && owner.managerId && owner.managerId !== owner.id) rows.push({ userId: owner.managerId, role: "MANAGER", percent: rates.manager });
  return rows.filter((r) => r.percent > 0).map((r) => ({ ...r, amount: round2((base * r.percent) / 100) }));
}

// ─── Profit and tax estimate ──────────────────────────────────────────────────

/**
 * Profit and an estimate of company income tax. Expenses and commissions are shared between local and
 * export income in proportion to each, then each part is taxed at its own rate. A loss means no tax.
 */
export function estimateTax(t: { localIncome: number; exportIncome: number; expenses: number; commissions: number; rate: number; exportRate: number }) {
  const income = t.localIncome + t.exportIncome;
  const costs = t.expenses + t.commissions;
  const profit = round2(income - costs);
  if (profit <= 0 || income <= 0) return { profit, localProfit: 0, exportProfit: 0, tax: 0, effectiveRate: 0 };
  const exportProfit = round2((profit * t.exportIncome) / income);
  const localProfit = round2(profit - exportProfit);
  const tax = round2((localProfit * t.rate) / 100 + (exportProfit * t.exportRate) / 100);
  return { profit, localProfit, exportProfit, tax, effectiveRate: Math.round((tax / profit) * 1000) / 10 };
}
