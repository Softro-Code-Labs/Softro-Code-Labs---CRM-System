import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { TicketPriority } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cn, firstParam, formatDate, fullName, parsePage } from "@/lib/utils";
import { OPEN_TICKET_STATUSES, TICKET_PRIORITY_LABELS, TICKET_PRIORITY_OPTIONS, TICKET_PRIORITY_TONE, TICKET_STATUS_LABELS, TICKET_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { SlaBadge } from "@/components/crm/sla-badge";

export const metadata: Metadata = { title: "Support" };

const PAGE_SIZE = 30;
const TABS = [
  { value: "open", label: "Open" },
  { value: "mine", label: "Mine" },
  { value: "overdue", label: "Reply overdue" },
  { value: "waiting", label: "Waiting on client" },
  { value: "done", label: "Resolved" },
  { value: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("ticket:view");
  const sp = await searchParams;
  const tabParam = firstParam(sp.tab);
  const tab: Tab = (TABS.map((t) => t.value) as string[]).includes(tabParam) ? (tabParam as Tab) : "open";
  const priorityParam = firstParam(sp.priority);
  const priority = (Object.values(TicketPriority) as string[]).includes(priorityParam) ? (priorityParam as TicketPriority) : undefined;
  const q = firstParam(sp.q);
  const page = parsePage(sp.page);
  const now = new Date();

  const open: Prisma.TicketWhereInput = { status: { in: OPEN_TICKET_STATUSES } };
  const filters: Record<Tab, Prisma.TicketWhereInput> = {
    open,
    mine: { ...open, assignedToId: user.id },
    overdue: { ...open, firstResponseAt: null, responseDueAt: { lt: now } },
    waiting: { status: "WAITING_ON_CLIENT" },
    done: { status: { in: ["RESOLVED", "CLOSED"] } },
    all: {},
  };
  const where: Prisma.TicketWhereInput = {
    ...filters[tab],
    ...(priority && { priority }),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [total, tickets, counts] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.findMany({
      where,
      orderBy: tab === "done" || tab === "all" ? [{ updatedAt: "desc" }] : [{ priority: "desc" }, { responseDueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
        contract: { select: { number: true } },
      },
    }),
    Promise.all((["open", "mine", "overdue"] as const).map((t) => db.ticket.count({ where: filters[t] }))),
  ]);
  const countFor: Partial<Record<Tab, number>> = { open: counts[0], mine: counts[1], overdue: counts[2] };

  const href = (t: string) => {
    const p = new URLSearchParams();
    if (t !== "open") p.set("tab", t);
    if (priority) p.set("priority", priority);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/support?${s}` : "/support";
  };

  return (
    <>
      <PageHeader
        title="Support"
        description="Client support requests. Log every reply so first-response times are tracked."
        actions={
          can(user.role, "ticket:create") && (
            <LinkButton href="/support/new">
              <Plus className="size-4" aria-hidden /> New ticket
            </LinkButton>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 pt-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={href(t.value)}
                className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium", tab === t.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800")}
              >
                {t.label}
                {countFor[t.value] ? (
                  <span className={cn("rounded-full px-1.5 text-xs font-semibold", t.value === "overdue" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-600")}>{countFor[t.value]}</span>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <FilterSelect param="priority" label="Any priority" options={TICKET_PRIORITY_OPTIONS} />
            <SearchInput placeholder="Search tickets…" />
          </div>
        </div>
        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title={tab === "overdue" ? "No overdue replies" : "No tickets here"} description="Log client issues from WhatsApp, email or calls as tickets so nothing gets forgotten." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Ticket</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned</th>
                  <th className="px-5 py-3">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link href={`/support/${t.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {t.subject}
                      </Link>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{t.number}</span>
                        {t.contract && <> · under {t.contract.number}</>}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{t.company?.name ?? (t.contact ? fullName(t.contact) : "—")}</td>
                    <td className="px-5 py-3">
                      <Badge tone={TICKET_PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABELS[t.priority]}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                        <SlaBadge ticket={t} compact />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{t.assignedTo?.name ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/support" params={{ tab: tab === "open" ? undefined : tab, priority, q: q || undefined }} />
      </Card>
    </>
  );
}
