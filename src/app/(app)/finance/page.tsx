import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { firstParam, formatMoney, toDateInput } from "@/lib/utils";
import { financePeriodOptions, resolveFinancePeriod } from "@/lib/finance-math";
import { financeScope, incomeSummary } from "@/lib/finance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { ExportMenu } from "@/components/reports/export-menu";
import { PeriodPicker } from "@/components/reports/period-picker";
import { compactMoney, StatTile } from "@/components/reports/charts";

export const metadata: Metadata = { title: "Income" };

const lkr = (v: number) => (v ? formatMoney(v, "LKR") : "—");

/**
 * Money clients paid in any period (tax-year and quarter presets), local and export apart, VAT kept out,
 * and the commission earned on it. Same scope as invoices: Sales their own, Managers theirs and their team's,
 * Admins everything. Expenses, profit and tax are worked out by the accountant from the full books.
 */
export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("finance:view");
  const sp = await searchParams;
  const period = resolveFinancePeriod({
    period: firstParam(sp.period),
    from: firstParam(sp.from),
    to: firstParam(sp.to),
  });
  const scope = await financeScope(user, firstParam(sp.person));
  const s = await incomeSummary(period, scope);
  const lastDay = new Date(period.to.getTime() - 86_400_000);

  const qs = new URLSearchParams();
  for (const k of ["period", "from", "to", "person"]) {
    const v = firstParam(sp[k]);
    if (v) qs.set(k, v);
  }
  const exportHref = (extra: Record<string, string>) =>
    `/finance/export?${new URLSearchParams([...qs.entries(), ...Object.entries(extra)]).toString()}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Income"
        description={`${period.label} · ${scope.label}. Money clients paid, in rupees, without VAT. Expenses, profit and income tax are worked out by your accountant.`}
        actions={
          can(user.role, "finance:export") && (
            <ExportMenu
              label="Export for accountant"
              items={[
                {
                  href: exportHref({ format: "pdf" }),
                  label: "PDF report",
                  hint: "Summary, months, payments and commission",
                  newTab: true,
                },
                {
                  href: exportHref({ format: "csv" }),
                  label: "CSV (Excel)",
                  hint: "Every payment and commission line",
                },
              ]}
            />
          )
        }
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <PeriodPicker
          from={toDateInput(period.from)}
          to={toDateInput(lastDay)}
          options={financePeriodOptions()}
          defaultValue="this-tax-year"
        />
        {scope.people.length > 1 && (
          <FilterSelect
            param="person"
            label={scope.all ? "Whole company" : "You and your team"}
            options={scope.people.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
      </div>

      {s.missingLkr.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            {s.missingLkr.length} foreign-currency{" "}
            {s.missingLkr.length === 1 ? "payment has" : "payments have"} no
            rupee amount, so{" "}
            {s.missingLkr.length === 1 ? "it isn't" : "they aren't"} counted
            below:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {s.missingLkr.map((p) => (
              <li key={p.id}>
                <Link href={`/invoices/${p.invoiceId}`} className="underline">
                  {p.receipt}
                </Link>{" "}
                ({formatMoney(p.amount, p.currency)}). Cancel it and record it
                again with the rupees credited.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Income (without VAT)"
          value={compactMoney(s.income, "LKR")}
          hint={`${s.paymentCount} ${s.paymentCount === 1 ? "payment" : "payments"} received`}
        />
        <StatTile
          label="From abroad (export)"
          value={compactMoney(s.exportIncome, "LKR")}
          hint={
            s.income > 0
              ? `${Math.round((s.exportIncome / s.income) * 100)}% of income · usually taxed at the lower rate`
              : "Paid in foreign currency through a bank"
          }
        />
        <StatTile
          label="VAT collected"
          value={compactMoney(s.vat, "LKR")}
          hint="Not income: it's paid on to the Inland Revenue"
        />
        <StatTile
          label="Sales commission"
          value={compactMoney(s.commissions, "LKR")}
          hint={
            <Link
              href="/commissions"
              className="text-brand-700 hover:underline"
            >
              See commissions
            </Link>
          }
        />
      </div>

      <Card>
        <CardHeader
          title="By month"
          description="Cash basis: income counts in the month the client paid."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-3">Month</th>
                <th className="px-5 py-3 text-right">Local income</th>
                <th className="px-5 py-3 text-right">Export income</th>
                <th className="px-5 py-3 text-right">Total income</th>
                <th className="px-5 py-3 text-right">VAT collected</th>
                <th className="px-5 py-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 tabular-nums">
              {s.months.map((m) => (
                <tr key={m.key}>
                  <td className="px-5 py-3 font-medium whitespace-nowrap text-ink-900">
                    {m.label}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {lkr(m.local)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {lkr(m.export)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium whitespace-nowrap text-ink-900">
                    {lkr(m.local + m.export)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {lkr(m.vat)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {lkr(m.commissions)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-ink-200 tabular-nums">
              <tr>
                <td className="px-5 py-3 font-semibold text-ink-900">Total</td>
                <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-ink-900">
                  {lkr(s.localIncome)}
                </td>
                <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-ink-900">
                  {lkr(s.exportIncome)}
                </td>
                <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-ink-900">
                  {lkr(s.income)}
                </td>
                <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-ink-900">
                  {lkr(s.vat)}
                </td>
                <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-ink-900">
                  {lkr(s.commissions)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
