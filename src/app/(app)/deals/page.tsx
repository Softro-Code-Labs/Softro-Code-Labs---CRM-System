import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { ServiceType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDefaultPipeline } from "@/lib/queries/pipeline";
import { cn, firstParam, formatDate, formatMoney, formatMoneyTotals, parsePage } from "@/lib/utils";
import { DEAL_STATUS_TONE, SERVICE_TYPE_OPTIONS, SERVICE_TYPE_SHORT } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchInput } from "@/components/ui/search-input";
import { startOfColomboMonth } from "@/lib/working-days";
import { DealBoard } from "./deal-board";

export const metadata: Metadata = { title: "Deals" };

const PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("deal:view");
  const sp = await searchParams;
  const view = firstParam(sp.view) === "list" ? "list" : "board";
  const owner = firstParam(sp.owner) === "me" ? "me" : "all";
  const serviceParam = firstParam(sp.service);
  const service = (Object.values(ServiceType) as string[]).includes(serviceParam) ? (serviceParam as ServiceType) : undefined;
  const statusParam = firstParam(sp.status);
  const status = statusParam === "WON" || statusParam === "LOST" || statusParam === "all" ? statusParam : "OPEN";
  const q = firstParam(sp.q);
  const page = parsePage(sp.page);

  const pipeline = await getDefaultPipeline();
  const base: Prisma.DealWhereInput = {
    pipelineId: pipeline.id,
    ...(owner === "me" && { ownerId: user.id }),
    ...(service && { serviceType: service }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const startOfMonth = startOfColomboMonth();

  const [openDeals, wonThisMonth] = await Promise.all([
    db.deal.findMany({
      where: { ...base, status: "OPEN" },
      orderBy: { stageChangedAt: "asc" },
      select: {
        id: true,
        title: true,
        value: true,
        currency: true,
        stageId: true,
        serviceType: true,
        stageChangedAt: true,
        expectedCloseDate: true,
        company: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    db.deal.findMany({ where: { ...base, status: "WON", closedAt: { gte: startOfMonth } }, select: { value: true, currency: true } }),
  ]);

  const now = new Date().getTime();
  const weighted = openDeals.map((d) => ({
    currency: d.currency,
    value: (Number(d.value) * (pipeline.openStages.find((s) => s.id === d.stageId)?.probability ?? 0)) / 100,
  }));

  const linkWith = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { view, owner, service, status: view === "list" ? status : undefined, q: q || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "view" && v === "board") && !(k === "owner" && v === "all") && !(k === "status" && v === "OPEN")) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/deals?${qs}` : "/deals";
  };

  const pill = (active: boolean) =>
    cn("rounded-md px-2.5 py-1 text-xs font-medium", active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800");

  return (
    <>
      <PageHeader
        title="Deals"
        description={`${pipeline.name} pipeline`}
        actions={
          can(user.role, "deal:create") && (
            <LinkButton href="/deals/new">
              <Plus className="size-4" aria-hidden /> New deal
            </LinkButton>
          )
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-500">Open pipeline ({openDeals.length})</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{formatMoneyTotals(openDeals)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-500">Weighted forecast</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{formatMoneyTotals(weighted)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-500">Won this month ({wonThisMonth.length})</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{formatMoneyTotals(wonThisMonth)}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-ink-200 bg-ink-100 p-1">
            <Link href={linkWith({ view: "board" })} className={pill(view === "board")}>Board</Link>
            <Link href={linkWith({ view: "list" })} className={pill(view === "list")}>List</Link>
          </div>
          <div className="inline-flex rounded-lg border border-ink-200 bg-ink-100 p-1">
            <Link href={linkWith({ owner: "all" })} className={pill(owner === "all")}>All deals</Link>
            <Link href={linkWith({ owner: "me" })} className={pill(owner === "me")}>My deals</Link>
          </div>
          {view === "list" && (
            <div className="inline-flex rounded-lg border border-ink-200 bg-ink-100 p-1">
              {(["OPEN", "WON", "LOST", "all"] as const).map((s) => (
                <Link key={s} href={linkWith({ status: s, page: undefined })} className={pill(status === s)}>
                  {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </Link>
              ))}
            </div>
          )}
          <FilterSelect param="service" label="All services" options={SERVICE_TYPE_OPTIONS} />
        </div>
        <SearchInput placeholder="Search deals or companies…" />
      </div>

      {view === "board" ? (
        <DealBoard
          canMove={can(user.role, "deal:update")}
          stages={pipeline.openStages.map((s) => ({ id: s.id, name: s.name, probability: s.probability }))}
          deals={openDeals.map((d) => ({
            id: d.id,
            title: d.title,
            value: d.value.toString(),
            currency: d.currency,
            stageId: d.stageId,
            serviceType: d.serviceType,
            companyName: d.company?.name ?? null,
            ownerName: d.owner?.name ?? null,
            daysInStage: Math.max(0, Math.floor((now - d.stageChangedAt.getTime()) / DAY_MS)),
            closeDate: d.expectedCloseDate ? formatDate(d.expectedCloseDate) : null,
            closeOverdue: Boolean(d.expectedCloseDate && d.expectedCloseDate.getTime() < now),
          }))}
        />
      ) : (
        <DealList where={{ ...base, ...(status !== "all" && { status }) }} page={page} params={{ view: "list", owner: owner === "me" ? "me" : undefined, service, status: status === "OPEN" ? undefined : status, q: q || undefined }} canCreate={can(user.role, "deal:create")} />
      )}
    </>
  );
}

async function DealList({ where, page, params, canCreate }: { where: Prisma.DealWhereInput; page: number; params: Record<string, string | undefined>; canCreate: boolean }) {
  const [total, deals] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        value: true,
        currency: true,
        status: true,
        serviceType: true,
        expectedCloseDate: true,
        closedAt: true,
        stage: { select: { name: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { name: true } },
      },
    }),
  ]);

  return (
    <Card>
      {deals.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No deals here"
          description="Convert a lead or create a deal to start tracking it."
          action={canCreate ? <LinkButton href="/deals/new"><Plus className="size-4" aria-hidden /> New deal</LinkButton> : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-3">Deal</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3 text-right">Value</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Close date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3">
                    <Link href={`/deals/${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {d.title}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {[d.company?.name, d.serviceType && SERVICE_TYPE_SHORT[d.serviceType]].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    {d.status === "OPEN" ? <span className="text-ink-700">{d.stage.name}</span> : <Badge tone={DEAL_STATUS_TONE[d.status]}>{d.stage.name}</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(d.value, d.currency)}</td>
                  <td className="px-5 py-3 text-ink-600">{d.owner?.name ?? "—"}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(d.closedAt ?? d.expectedCloseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/deals" params={params} />
    </Card>
  );
}
