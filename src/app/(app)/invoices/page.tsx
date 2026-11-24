import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { balanceDue, invoiceState } from "@/lib/invoices";
import { colomboDayBounds, startOfColomboMonth } from "@/lib/working-days";
import { cn, firstParam, formatDate, formatMoney, formatMoneyTotals, fullName, parsePage } from "@/lib/utils";
import { INVOICE_STATE_LABELS, INVOICE_STATE_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";

export const metadata: Metadata = { title: "Invoices" };

const PAGE_SIZE = 25;
const TABS = [
  { value: "", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("invoice:view");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const tabParam = firstParam(sp.tab);
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : "";
  const page = parsePage(sp.page);
  const today = colomboDayBounds(new Date()).start;

  const byTab: Record<Tab, Prisma.InvoiceWhereInput> = {
    "": { status: "ISSUED" },
    overdue: { status: "ISSUED", dueDate: { lt: today } },
    paid: { status: "PAID" },
    void: { status: "VOID" },
    all: {},
  };
  const v = await getVisibility(user);
  const where: Prisma.InvoiceWhereInput = {
    AND: [v.invoice],
    ...byTab[tab],
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
        { contact: { firstName: { contains: q, mode: "insensitive" } } },
        { payments: { some: { receiptNumber: { contains: q, mode: "insensitive" } } } },
      ],
    }),
  };

  const [total, invoices, open, received] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: tab === "" || tab === "overdue" ? [{ dueDate: "asc" }, { createdAt: "asc" }] : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
    }),
    db.invoice.findMany({ where: { AND: [v.invoice], status: "ISSUED" }, select: { total: true, amountPaid: true, currency: true, dueDate: true } }),
    db.payment.findMany({ where: { invoice: v.invoice, paidAt: { gte: startOfColomboMonth() } }, select: { amount: true, invoice: { select: { currency: true } } } }),
  ]);

  const owed = open.map((i) => ({ value: balanceDue(i), currency: i.currency }));
  const overdue = open.filter((i) => i.dueDate && i.dueDate < today);
  const tabHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("tab", value);
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="What clients owe us, and receipts for what they've paid."
        actions={
          can(user.role, "invoice:create") && (
            <LinkButton href="/invoices/new">
              <Plus className="size-4" aria-hidden /> New invoice
            </LinkButton>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-500">Owed to us</p>
          <p className="mt-1 text-xl font-semibold text-ink-900 tabular-nums">{owed.length ? formatMoneyTotals(owed) : "Nothing"}</p>
          <p className="text-xs text-ink-500">{open.length} unpaid invoice{open.length === 1 ? "" : "s"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-500">Overdue</p>
          <p className={cn("mt-1 text-xl font-semibold tabular-nums", overdue.length ? "text-red-600" : "text-ink-900")}>
            {overdue.length ? formatMoneyTotals(overdue.map((i) => ({ value: balanceDue(i), currency: i.currency }))) : "Nothing"}
          </p>
          <p className="text-xs text-ink-500">{overdue.length} past the due date</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-500">Received this month</p>
          <p className="mt-1 text-xl font-semibold text-ink-900 tabular-nums">
            {received.length ? formatMoneyTotals(received.map((p) => ({ value: p.amount, currency: p.invoice.currency }))) : "Nothing yet"}
          </p>
          <p className="text-xs text-ink-500">{received.length} payment{received.length === 1 ? "" : "s"}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 pt-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link
                key={t.value || "unpaid"}
                href={tabHref(t.value)}
                className={cn("-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium", tab === t.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800")}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="mb-2">
            <SearchInput placeholder="Search number, receipt, title or client…" />
          </div>
        </div>
        {invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={q ? "No invoices match" : tab === "" ? "Nothing unpaid" : "No invoices here"}
            description={q ? "Try a different search or tab." : "Invoice an accepted quote from its page, or create one here."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invoices.map((inv) => {
                  const state = invoiceState(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-ink-50">
                      <td className="px-5 py-3">
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {inv.title}
                        </Link>
                        <p className="font-mono text-xs text-ink-500">
                          {inv.number} · {formatDate(inv.issueDate)}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-ink-700">{inv.company?.name ?? (inv.contact ? fullName(inv.contact) : "—")}</td>
                      <td className="px-5 py-3">
                        <Badge tone={INVOICE_STATE_TONE[state]}>{INVOICE_STATE_LABELS[state]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(inv.total, inv.currency)}</td>
                      <td className="px-5 py-3 text-right font-medium whitespace-nowrap tabular-nums">{inv.status === "ISSUED" ? formatMoney(balanceDue(inv), inv.currency) : "—"}</td>
                      <td className={cn("px-5 py-3 whitespace-nowrap", state === "overdue" ? "font-medium text-red-600" : "text-ink-500")}>{formatDate(inv.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/invoices" params={{ q: q || undefined, tab: tab || undefined }} />
      </Card>
    </>
  );
}
