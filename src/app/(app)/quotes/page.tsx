import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { QuoteStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { isExpired } from "@/lib/quotes";
import { cn, firstParam, formatDate, formatMoney, formatMoneyTotals, fullName, parsePage } from "@/lib/utils";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";

export const metadata: Metadata = { title: "Quotes" };

const PAGE_SIZE = 25;
const TABS = [{ value: "", label: "All" }, ...Object.values(QuoteStatus).map((s) => ({ value: s, label: QUOTE_STATUS_LABELS[s] }))];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("quote:view");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const statusParam = firstParam(sp.status);
  const status = (Object.values(QuoteStatus) as string[]).includes(statusParam) ? (statusParam as QuoteStatus) : undefined;
  const page = parsePage(sp.page);

  const v = await getVisibility(user);
  const where: Prisma.QuoteWhereInput = {
    AND: [v.quote],
    ...(status && { status }),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
        { contact: { firstName: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [total, quotes, openQuotes] = await Promise.all([
    db.quote.count({ where }),
    db.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
    }),
    db.quote.findMany({ where: { AND: [v.quote], status: "SENT" }, select: { total: true, currency: true } }),
  ]);

  const tabHref = (value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("status", value);
    const qs = params.toString();
    return qs ? `/quotes?${qs}` : "/quotes";
  };

  return (
    <>
      <PageHeader
        title="Quotes"
        description={openQuotes.length ? `${openQuotes.length} sent and waiting for an answer · ${formatMoneyTotals(openQuotes.map((o) => ({ value: o.total, currency: o.currency })))}` : "Quotations for client projects."}
        actions={
          can(user.role, "quote:create") && (
            <LinkButton href="/quotes/new">
              <Plus className="size-4" aria-hidden /> New quote
            </LinkButton>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 pt-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link
                key={t.value || "all"}
                href={tabHref(t.value)}
                className={cn("-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium", (status ?? "") === t.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800")}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="mb-2">
            <SearchInput placeholder="Search number, title or client…" />
          </div>
        </div>
        {quotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={q || status ? "No quotes match" : "No quotes yet"}
            description={q || status ? "Try a different search or tab." : "Create a quote from a deal, or start one here."}
            action={!q && !status && can(user.role, "quote:create") ? <LinkButton href="/quotes/new"><Plus className="size-4" aria-hidden /> New quote</LinkButton> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Quote</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Valid until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link href={`/quotes/${quote.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {quote.title}
                      </Link>
                      <p className="font-mono text-xs text-ink-500">
                        {quote.number} · {formatDate(quote.issueDate)}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{quote.company?.name ?? (quote.contact ? fullName(quote.contact) : "—")}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={QUOTE_STATUS_TONE[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
                        {isExpired(quote) && <Badge tone="amber">Past valid date</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(quote.total, quote.currency)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(quote.validUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/quotes" params={{ q: q || undefined, status }} />
      </Card>
    </>
  );
}
