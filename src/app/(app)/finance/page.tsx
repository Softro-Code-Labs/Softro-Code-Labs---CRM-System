import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getOrgSettings } from "@/lib/queries/org";
import { firstParam, formatMoney, toDateInput } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/crm-meta";
import { financePeriodOptions, resolveFinancePeriod } from "@/lib/finance-math";
import { financeSummary } from "@/lib/finance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { PeriodPicker } from "@/components/reports/period-picker";
import { BarList, compactMoney, StatTile } from "@/components/reports/charts";

export const metadata: Metadata = { title: "Income & tax" };

const lkr = (v: number) => formatMoney(v, "LKR");
const pct = (v: { toString(): string }) => `${Number(v.toString())}%`;

function Line({ label, value, hint, strong, minus }: { label: string; value: number; hint?: string; strong?: boolean; minus?: boolean }) {
  return (
    <div className={strong ? "flex items-baseline justify-between gap-4 border-t border-ink-200 px-5 py-3" : "flex items-baseline justify-between gap-4 px-5 py-2.5"}>
      <div>
        <p className={strong ? "text-sm font-semibold text-ink-900" : "text-sm text-ink-700"}>{label}</p>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
      <p className={strong ? "text-base font-semibold text-ink-900 tabular-nums" : "text-sm text-ink-900 tabular-nums"}>
        {minus && value > 0 ? "− " : ""}
        {lkr(value)}
      </p>
    </div>
  );
}

/**
 * Income, expenses, commission, profit and an income tax estimate for any period, with
 * tax-year (April–March) and quarter presets. A planning figure: the accountant files the return.
 */
export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("finance:view");
  const sp = await searchParams;
  const period = resolveFinancePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) });
  const org = await getOrgSettings();
  const s = await financeSummary(period, org);
  const lastDay = new Date(period.to.getTime() - 86_400_000);

  const qs = new URLSearchParams();
  for (const k of ["period", "from", "to"]) {
    const v = firstParam(sp[k]);
    if (v) qs.set(k, v);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Income & tax"
        description={`${period.label}. Money the company received and spent, in rupees, and an estimate of the income tax on the profit.`}
        actions={
          <a href={`/finance/export?${qs.toString()}`} className={buttonClass("secondary", "md")}>
            <FileDown className="size-4" aria-hidden /> Export for accountant
          </a>
        }
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <PeriodPicker from={toDateInput(period.from)} to={toDateInput(lastDay)} options={financePeriodOptions()} defaultValue="this-tax-year" />
      </div>

      {s.missingLkr.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            {s.missingLkr.length} foreign-currency {s.missingLkr.length === 1 ? "payment has" : "payments have"} no rupee amount, so {s.missingLkr.length === 1 ? "it isn't" : "they aren't"} counted below:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {s.missingLkr.map((p) => (
              <li key={p.id}>
                <Link href={`/invoices/${p.invoiceId}`} className="underline">{p.receipt}</Link> ({formatMoney(p.amount, p.currency)}). Cancel it and record it again with the rupees credited.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Income (without VAT)" value={compactMoney(s.income, "LKR")} hint={`${s.paymentCount} ${s.paymentCount === 1 ? "payment" : "payments"} received`} />
        <StatTile label="Expenses and commission" value={compactMoney(s.expenses + s.commissions, "LKR")} hint={`${compactMoney(s.commissions, "LKR")} of it commission`} />
        <StatTile label={s.profit < 0 ? "Loss" : "Profit"} value={compactMoney(Math.abs(s.profit), "LKR")} tone={s.profit < 0 ? "bad" : undefined} hint={s.income > 0 ? `${Math.round((s.profit / s.income) * 100)}% of income` : undefined} />
        <StatTile label="Estimated income tax" value={compactMoney(s.tax, "LKR")} hint={s.tax > 0 ? `About ${s.effectiveRate}% of the profit` : "No tax on a loss"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="How it adds up" description="Cash basis: money in when received, money out when paid." />
          <div className="py-2">
            <Line label="Income from Sri Lankan clients" value={s.localIncome} hint="Paid in rupees" />
            <Line label="Income from abroad" value={s.exportIncome} hint="Paid in foreign currency: export of services" />
            <Line label="Total income" value={s.income} strong />
            <Line label="Business expenses" value={s.expenses} minus />
            <Line label="Sales commission" value={s.commissions} minus />
            <Line label={s.profit < 0 ? "Loss" : "Profit before tax"} value={s.profit} strong />
            {s.profit > 0 && (
              <>
                <Line label={`Tax on local profit at ${pct(org.incomeTaxPercent)}`} value={Math.round(s.localProfit * Number(org.incomeTaxPercent)) / 100} hint={`On ${lkr(s.localProfit)} of the profit`} />
                {s.exportProfit > 0 && <Line label={`Tax on export profit at ${pct(org.exportIncomeTaxPercent)}`} value={Math.round(s.exportProfit * Number(org.exportIncomeTaxPercent)) / 100} hint={`On ${lkr(s.exportProfit)} of the profit`} />}
              </>
            )}
            <Line label="Estimated income tax" value={s.tax} strong />
          </div>
          <CardBody className="space-y-1 border-t border-ink-100 text-xs text-ink-500">
            <p>
              Expenses and commission are shared between local and export income in proportion, then each part is taxed at its rate. Rates are in{" "}
              {can(user.role, "org:manage") ? <Link href="/settings/finance" className="underline">Settings → Commission &amp; tax</Link> : "Settings (Admin)"}.
            </p>
            <p>This is a planning estimate. Your accountant works out the real figure (allowances, equipment written off over years, instalments already paid) and files the return.</p>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="VAT collected" description="Not income: it's paid on to the Inland Revenue." />
            <CardBody>
              <p className="text-2xl font-semibold text-ink-900 tabular-nums">{lkr(s.vat)}</p>
              <p className="mt-1 text-xs text-ink-500">{s.vat > 0 ? "From invoices with VAT, in proportion to what was paid." : "No VAT on payments in this period. You only charge VAT once registered."}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Expenses by category" action={<Link href="/expenses" className="text-sm font-medium text-brand-700 hover:underline">Expenses</Link>} />
            <BarList empty="No expenses in this period." rows={s.byCategory.map((r) => ({ key: r.category, label: EXPENSE_CATEGORY_LABELS[r.category], value: r.total, display: compactMoney(r.total, "LKR") }))} />
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="By month" />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-3">Month</th>
                <th className="px-5 py-3 text-right">Income</th>
                <th className="px-5 py-3 text-right">Expenses</th>
                <th className="px-5 py-3 text-right">Commission</th>
                <th className="px-5 py-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 tabular-nums">
              {s.months.map((m) => (
                <tr key={m.key}>
                  <td className="px-5 py-3 font-medium whitespace-nowrap text-ink-900">{m.label}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">{m.income ? lkr(m.income) : "—"}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">{m.expenses ? lkr(m.expenses) : "—"}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">{m.commissions ? lkr(m.commissions) : "—"}</td>
                  <td className={m.profit < 0 ? "px-5 py-3 text-right font-medium whitespace-nowrap text-red-600" : "px-5 py-3 text-right font-medium whitespace-nowrap text-ink-900"}>{m.profit ? lkr(m.profit) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
