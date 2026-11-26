import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getVisibleUserIds } from "@/lib/visibility";
import { getOrgSettings } from "@/lib/queries/org";
import { firstParam, formatDate, formatMoney, toDateInput } from "@/lib/utils";
import { COMMISSION_ROLE_LABELS } from "@/lib/crm-meta";
import { financePeriodOptions, resolveFinancePeriod } from "@/lib/finance-math";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-select";
import { PeriodPicker } from "@/components/reports/period-picker";
import { StatTile } from "@/components/reports/charts";
import { AddMissingButton, PaidToggle, PayAllButton } from "./commission-controls";
import { PAYMENTS_WITHOUT_COMMISSION } from "@/lib/commissions";

export const metadata: Metadata = { title: "Commissions" };

const pct = (v: { toString(): string }) => `${Number(v.toString())}%`;

/**
 * Commission earned on money clients paid, by the date they paid.
 * Sales people see their own, Managers their team's, Admins everyone's and mark it paid.
 */
export default async function CommissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("commission:view");
  const sp = await searchParams;
  const period = resolveFinancePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) });
  const visible = await getVisibleUserIds(user.id, user.role);
  const canPay = can(user.role, "commission:pay");

  const [people, org, noManager, missing] = await Promise.all([
    db.user.findMany({ where: { ...(visible && { id: { in: visible } }), OR: [{ isActive: true }, { commissions: { some: {} } }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getOrgSettings(),
    canPay ? db.user.findMany({ where: { isActive: true, role: { in: ["SALES", "SUPPORT"] }, managerId: null }, select: { name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canPay ? db.payment.count({ where: PAYMENTS_WITHOUT_COMMISSION }) : Promise.resolve(0),
  ]);
  const personParam = firstParam(sp.person);
  const person = people.find((p) => p.id === personParam);
  const status = firstParam(sp.status);

  const rows = await db.commission.findMany({
    where: {
      payment: { paidAt: { gte: period.from, lt: period.to } },
      ...(person ? { userId: person.id } : visible && { userId: { in: visible } }),
      ...(status === "unpaid" && { paidAt: null }),
      ...(status === "paid" && { paidAt: { not: null } }),
    },
    orderBy: [{ payment: { paidAt: "desc" } }, { role: "asc" }],
    take: 1000,
    include: {
      user: { select: { name: true } },
      payment: { select: { receiptNumber: true, paidAt: true, invoice: { select: { id: true, number: true, title: true, deal: { select: { id: true, title: true } } } } } },
    },
  });

  const sum = (list: typeof rows) => list.reduce((s, r) => s + Number(r.amount), 0);
  const unpaid = rows.filter((r) => !r.paidAt);
  const earned = sum(rows);
  const lastDay = new Date(period.to.getTime() - 86_400_000);
  const scope = visible === null ? "Everyone" : visible.length === 1 ? "You" : "You and your team";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Commissions"
        description={`Earned when the client pays, on the amount without VAT. A sales person gets ${pct(org.commissionSalesPercent)} and their manager ${pct(org.commissionManagerPercent)}; a Manager or Admin who makes the sale gets ${pct(org.commissionLeaderPercent)}.`}
        actions={
          canPay && (
            <div className="flex flex-wrap gap-2">
              <AddMissingButton count={missing} />
              <PayAllButton ids={unpaid.map((r) => r.id)} total={formatMoney(sum(unpaid), "LKR")} />
            </div>
          )
        }
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <PeriodPicker from={toDateInput(period.from)} to={toDateInput(lastDay)} options={financePeriodOptions()} defaultValue="this-tax-year" />
        {people.length > 1 && <FilterSelect param="person" label={scope} options={people.map((p) => ({ value: p.id, label: p.name }))} />}
        <FilterSelect param="status" label="Paid and unpaid" options={[{ value: "unpaid", label: "Unpaid only" }, { value: "paid", label: "Paid only" }]} />
      </div>

      {noManager.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {noManager.map((u) => u.name).join(", ")} {noManager.length === 1 ? "has" : "have"} no manager, so no manager&apos;s commission is added for their sales.{" "}
          <Link href="/settings/users" className="font-medium underline">Set a manager</Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Earned" value={formatMoney(earned, "LKR")} hint={`${period.label}${person ? ` · ${person.name}` : ""}`} />
        <StatTile label="Paid out" value={formatMoney(earned - sum(unpaid), "LKR")} />
        <StatTile label="Still to pay" value={formatMoney(sum(unpaid), "LKR")} hint={unpaid.length ? `${unpaid.length} ${unpaid.length === 1 ? "line" : "lines"}` : "Nothing waiting"} />
      </div>

      <Card>
        <CardHeader title={`Commission lines (${rows.length})`} />
        {rows.length === 0 ? (
          <CardBody className="text-sm text-ink-500">No commission in this period. It appears here when a client pays an invoice for a deal.</CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Client paid</th>
                  <th className="px-5 py-3">Person</th>
                  <th className="px-5 py-3">Deal and invoice</th>
                  <th className="px-5 py-3 text-right">Paid without VAT</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                  <th className="px-5 py-3 text-right">Commission</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular-nums">
                {rows.map((r) => {
                  const inv = r.payment.invoice;
                  return (
                    <tr key={r.id}>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatDate(r.payment.paidAt)}
                        <span className="block text-xs text-ink-500">{r.payment.receiptNumber}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium whitespace-nowrap text-ink-900">{r.user.name}</span>
                        <span className="block text-xs text-ink-500">{COMMISSION_ROLE_LABELS[r.role]}</span>
                      </td>
                      <td className="px-5 py-3">
                        {inv.deal ? (
                          <Link href={`/deals/${inv.deal.id}`} className="font-medium text-ink-900 hover:text-brand-700">{inv.deal.title}</Link>
                        ) : (
                          <span className="text-ink-900">{inv.title}</span>
                        )}
                        <Link href={`/invoices/${inv.id}`} className="block text-xs text-ink-500 hover:text-brand-700">{inv.number}</Link>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{formatMoney(r.base, "LKR")}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{pct(r.percent)}</td>
                      <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-ink-900">{formatMoney(r.amount, "LKR")}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {canPay ? (
                          <span className="inline-flex items-center gap-2">
                            {r.paidAt && <Badge tone="green">Paid {formatDate(r.paidAt)}</Badge>}
                            <PaidToggle id={r.id} paid={Boolean(r.paidAt)} />
                          </span>
                        ) : r.paidAt ? (
                          <Badge tone="green">Paid {formatDate(r.paidAt)}</Badge>
                        ) : (
                          <Badge tone="amber">Unpaid</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
