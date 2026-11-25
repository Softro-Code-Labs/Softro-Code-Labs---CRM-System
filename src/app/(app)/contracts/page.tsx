import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { monthlyValue } from "@/lib/contracts";
import { cn, firstParam, formatDate, formatMoney, formatMoneyTotals } from "@/lib/utils";
import { BILLING_CYCLE_SHORT, CONTRACT_TYPE_LABELS } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { ContractStateBadge } from "@/components/crm/contract-state-badge";

export const metadata: Metadata = { title: "Contracts" };

const TABS = [
  { value: "active", label: "Active" },
  { value: "renew", label: "Renewing soon" },
  { value: "ended", label: "Ended" },
  { value: "all", label: "All" },
] as const;

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("contract:view");
  const sp = await searchParams;
  const tabParam = firstParam(sp.tab);
  const tab = (TABS.map((t) => t.value) as string[]).includes(tabParam) ? tabParam : "active";
  const q = firstParam(sp.q);
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 86_400_000);

  const search: Prisma.ContractWhereInput = q
    ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { number: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }] }
    : {};
  const v = await getVisibility(user);
  const where: Prisma.ContractWhereInput = {
    AND: [v.contract],
    ...search,
    ...(tab === "active" && { status: { in: ["ACTIVE", "PAUSED"] } }),
    ...(tab === "renew" && { status: "ACTIVE", endDate: { not: null, lte: in90 } }),
    ...(tab === "ended" && { status: { in: ["ENDED", "CANCELLED"] } }),
  };

  const [contracts, active] = await Promise.all([
    db.contract.findMany({
      where,
      orderBy: tab === "renew" || tab === "active" ? [{ endDate: { sort: "asc", nulls: "last" } }] : [{ updatedAt: "desc" }],
      take: 300,
      include: { company: { select: { name: true } } },
    }),
    db.contract.findMany({ where: { AND: [v.contract], status: "ACTIVE" }, select: { amount: true, currency: true, billingCycle: true, endDate: true, renewalNoticeDays: true } }),
  ]);
  // Only show contracts that are inside their reminder window on the "Renewing soon" tab.
  const rows = tab === "renew" ? contracts.filter((c) => c.endDate && c.endDate.getTime() - c.renewalNoticeDays * 86_400_000 <= now.getTime()) : contracts;
  const renewSoon = active.filter((c) => c.endDate && c.endDate.getTime() - c.renewalNoticeDays * 86_400_000 <= now.getTime()).length;
  const mrr = formatMoneyTotals(active.filter((c) => c.billingCycle !== "ONE_TIME").map((c) => ({ currency: c.currency, value: monthlyValue(c.amount, c.billingCycle) })));

  const href = (t: string) => {
    const p = new URLSearchParams();
    if (t !== "active") p.set("tab", t);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/contracts?${s}` : "/contracts";
  };

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Maintenance, hosting, retainers and subscriptions."
        actions={
          can(user.role, "contract:manage") && (
            <LinkButton href="/contracts/new">
              <Plus className="size-4" aria-hidden /> New contract
            </LinkButton>
          )
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-500">Active contracts</p>
          <p className="mt-1 text-lg font-semibold">{active.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-500">Monthly recurring value</p>
          <p className="mt-1 text-lg font-semibold">{mrr}</p>
        </Card>
        <Card className={cn("p-4", renewSoon > 0 && "border-amber-200 bg-amber-50/50")}>
          <p className="text-xs font-medium text-ink-500">Due for renewal now</p>
          <p className="mt-1 text-lg font-semibold">{renewSoon}</p>
        </Card>
      </div>
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 pt-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link key={t.value} href={href(t.value)} className={cn("-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium", tab === t.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800")}>
                {t.label}
              </Link>
            ))}
          </div>
          <div className="mb-2">
            <SearchInput placeholder="Search contracts or clients…" />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={FileSignature} title={tab === "renew" ? "Nothing to renew right now" : "No contracts here"} description="Add maintenance, hosting or support agreements to track renewals and recurring income." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Contract</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3">Ends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link href={`/contracts/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {c.title}
                      </Link>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{c.number}</span> · {CONTRACT_TYPE_LABELS[c.type]}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{c.company.name}</td>
                    <td className="px-5 py-3">
                      <ContractStateBadge contract={c} />
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatMoney(c.amount, c.currency)} <span className="text-xs text-ink-500">{BILLING_CYCLE_SHORT[c.billingCycle]}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-500">{c.endDate ? formatDate(c.endDate) : "Open-ended"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
