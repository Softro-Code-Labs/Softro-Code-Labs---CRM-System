import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { firstParam, formatDate, formatMoney, toDateInput } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_OPTIONS } from "@/lib/crm-meta";
import { financePeriodOptions, resolveFinancePeriod } from "@/lib/finance-math";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { PeriodPicker } from "@/components/reports/period-picker";
import { BarList, compactMoney } from "@/components/reports/charts";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { ExpenseRow, NewExpenseForm } from "./expense-form";

export const metadata: Metadata = { title: "Expenses" };

/** Business expenses in rupees, with their bills. They come off income on the Income & tax page. */
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("expense:manage");
  const sp = await searchParams;
  const period = resolveFinancePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) });
  const categoryParam = firstParam(sp.category);
  const category = EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === categoryParam)?.value as ExpenseCategory | undefined;
  const inPeriod = { date: { gte: period.from, lt: period.to } };

  const [expenses, byCategory] = await Promise.all([
    db.expense.findMany({ where: { ...inPeriod, ...(category && { category }) }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 }),
    db.expense.groupBy({ by: ["category"], where: inPeriod, _sum: { amount: true }, _count: true }),
  ]);
  const total = byCategory.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  const count = byCategory.reduce((s, r) => s + r._count, 0);
  const lastDay = new Date(period.to.getTime() - 86_400_000);
  const shownTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Expenses"
        description={`${period.label}: ${formatMoney(total, "LKR")} in ${count} ${count === 1 ? "expense" : "expenses"}. Salaries go in as one line a month; payslips, EPF and ETF stay with your accountant.`}
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <PeriodPicker from={toDateInput(period.from)} to={toDateInput(lastDay)} options={financePeriodOptions()} defaultValue="this-tax-year" />
        <FilterSelect param="category" label="All categories" options={EXPENSE_CATEGORY_OPTIONS} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Add an expense" description="Amounts in rupees. Sales commission is added for you when clients pay, so don't enter it here." />
          <CardBody>
            <NewExpenseForm today={toDateInput(new Date())} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="By category" />
          <BarList
            empty="No expenses in this period."
            rows={byCategory
              .map((r) => ({ key: r.category, label: EXPENSE_CATEGORY_LABELS[r.category], value: Number(r._sum.amount ?? 0), display: compactMoney(Number(r._sum.amount ?? 0), "LKR") }))
              .sort((a, b) => b.value - a.value)}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title={category ? `${EXPENSE_CATEGORY_LABELS[category]} (${expenses.length})` : `All expenses (${expenses.length})`} description={expenses.length ? `Total shown: ${formatMoney(shownTotal, "LKR")}` : undefined} />
        {expenses.length === 0 ? (
          <CardBody className="text-sm text-ink-500">Nothing recorded for this period yet.</CardBody>
        ) : (
          <ul className="divide-y divide-ink-100">
            {expenses.map((e) => (
              <li key={e.id} className="px-5 py-4">
                <ExpenseRow
                  id={e.id}
                  hasReceipt={Boolean(e.receiptName)}
                  initial={{
                    date: toDateInput(e.date),
                    category: e.category,
                    description: e.description,
                    supplier: e.supplier ?? "",
                    amount: e.amount.toString(),
                    reference: e.reference ?? "",
                    notes: e.notes ?? "",
                  }}
                  summary={
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{e.description}</p>
                        <p className="text-xs text-ink-500">
                          {[formatDate(e.date), EXPENSE_CATEGORY_LABELS[e.category], e.supplier, e.reference].filter(Boolean).join(" · ")}
                          {!e.receiptName && <span className="text-amber-700"> · no receipt</span>}
                        </p>
                        {e.notes && <p className="mt-0.5 text-xs text-ink-500">{e.notes}</p>}
                      </div>
                      <p className="text-sm font-semibold text-ink-900 tabular-nums">{formatMoney(e.amount, "LKR")}</p>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
