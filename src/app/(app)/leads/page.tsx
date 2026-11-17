import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { LeadSource, LeadStatus, ServiceType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cn, firstParam, formatDate, formatMoney, parsePage } from "@/lib/utils";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  OPEN_LEAD_STATUSES,
  SERVICE_TYPE_OPTIONS,
  SERVICE_TYPE_SHORT,
} from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { ReplyBadge } from "@/components/crm/reply-badge";
import { FilterSelect } from "@/components/ui/filter-select";

export const metadata: Metadata = { title: "Leads" };

const PAGE_SIZE = 25;

const TABS = [
  { value: "open", label: "Open" },
  { value: "needs-reply", label: "Needs reply" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CONVERTED", label: "Converted" },
  { value: "UNQUALIFIED", label: "Unqualified" },
  { value: "all", label: "All" },
] as const;

function pick<T extends string>(value: string, allowed: readonly T[]) {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("lead:view");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const tab = pick(firstParam(sp.tab), TABS.map((t) => t.value)) ?? "open";
  const source = pick(firstParam(sp.source), Object.values(LeadSource));
  const service = pick(firstParam(sp.service), Object.values(ServiceType));
  const page = parsePage(sp.page);

  const statusFilter: Prisma.LeadWhereInput =
    tab === "open"
      ? { status: { in: OPEN_LEAD_STATUSES } }
      : tab === "needs-reply"
        ? { status: { in: OPEN_LEAD_STATUSES }, respondedAt: null }
        : tab === "all"
          ? {}
          : { status: tab as LeadStatus };

  const where: Prisma.LeadWhereInput = {
    ...statusFilter,
    ...(source && { source }),
    ...(service && { serviceType: service }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { whatsapp: { contains: q } },
      ],
    }),
  };

  const [total, leads, needsReplyCount] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      // Leads waiting on a reply come first, soonest deadline at the top.
      orderBy: tab === "needs-reply" || tab === "open" ? [{ respondedAt: { sort: "desc", nulls: "first" } }, { respondBy: "asc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        contactName: true,
        companyName: true,
        source: true,
        serviceType: true,
        status: true,
        estimatedValue: true,
        currency: true,
        respondBy: true,
        respondedAt: true,
        createdAt: true,
        owner: { select: { name: true } },
      },
    }),
    db.lead.count({ where: { status: { in: OPEN_LEAD_STATUSES }, respondedAt: null } }),
  ]);

  const params = { q: q || undefined, tab: tab === "open" ? undefined : tab, source, service };
  const tabHref = (value: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (value !== "open") sp.set("tab", value);
    if (source) sp.set("source", source);
    if (service) sp.set("service", service);
    const qs = sp.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };
  const filtered = Boolean(q || source || service);

  return (
    <>
      <PageHeader
        title="Leads"
        description="New enquiries from WhatsApp, the website and referrals. We reply within 2 working days."
        actions={
          can(user.role, "lead:create") && (
            <LinkButton href="/leads/new">
              <Plus className="size-4" aria-hidden /> New lead
            </LinkButton>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 pt-3">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={tabHref(t.value)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium",
                tab === t.value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              {t.value === "needs-reply" && needsReplyCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">{needsReplyCount}</span>
              )}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <FilterSelect param="source" label="All sources" options={LEAD_SOURCE_OPTIONS} />
            <FilterSelect param="service" label="All services" options={SERVICE_TYPE_OPTIONS} />
          </div>
          <SearchInput placeholder="Search leads…" />
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={Target}
            title={filtered ? "No leads match your filters" : tab === "needs-reply" ? "Everyone has a reply. Nice work!" : "No leads here yet"}
            description={filtered ? "Try a different search or filter." : "New enquiries from WhatsApp, the website or referrals will show up here."}
            action={
              !filtered && can(user.role, "lead:create") ? (
                <LinkButton href="/leads/new">
                  <Plus className="size-4" aria-hidden /> New lead
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Est. value</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {lead.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>{[lead.contactName, lead.companyName].filter(Boolean).join(" · ") || "—"}</span>
                        {lead.serviceType && <span className="text-brand-600">{SERVICE_TYPE_SHORT[lead.serviceType]}</span>}
                      </p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{LEAD_SOURCE_LABELS[lead.source]}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                        {lead.status !== "CONVERTED" && lead.status !== "UNQUALIFIED" && (
                          <ReplyBadge respondBy={lead.respondBy} respondedAt={lead.respondedAt} compact />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">
                      {lead.estimatedValue ? formatMoney(lead.estimatedValue, lead.currency) : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{lead.owner?.name ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/leads" params={params} />
      </Card>
    </>
  );
}
