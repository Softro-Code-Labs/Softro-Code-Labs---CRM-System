import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Briefcase, Handshake, Target, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { balanceDue } from "@/lib/invoices";
import { getDefaultPipeline } from "@/lib/queries/pipeline";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ReplyBadge } from "@/components/crm/reply-badge";
import { cn, formatDate, formatMoney, formatMoneyTotals } from "@/lib/utils";
import { LEAD_SOURCE_LABELS, OPEN_LEAD_STATUSES } from "@/lib/crm-meta";
import { colomboDayBounds, startOfColomboMonth } from "@/lib/working-days";
import { activitySelect } from "@/lib/activities";
import { DoneCheckbox } from "@/components/crm/activity-controls";
import { ContractStateBadge } from "@/components/crm/contract-state-badge";
import { ACTIVITY_ICONS, ActivityContext, formatWhen } from "@/components/crm/record-timeline";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePermission("dashboard:view");
  const { denied } = await searchParams;
  const now = new Date();
  const monthStart = startOfColomboMonth(now);
  const pipeline = await getDefaultPipeline();
  // Sales see only their own numbers, Managers their team's, Admins the whole company.
  const v = await getVisibility(user);

  const { end: endOfToday } = colomboDayBounds(now);
  const waitingWhere = { AND: [v.lead], status: { in: OPEN_LEAD_STATUSES }, respondedAt: null };
  const myTasksWhere = { assignedToId: user.id, completedAt: null, OR: [{ dueAt: { lt: endOfToday } }, { dueAt: null }] };
  const in45 = new Date(now.getTime() + 45 * 86_400_000);
  const showMoney = can(user.role, "invoice:view");
  const [unpaidInvoices, receivedThisMonth] = showMoney
    ? await Promise.all([
        db.invoice.findMany({
          where: { AND: [v.invoice], status: "ISSUED" },
          orderBy: [{ dueDate: "asc" }],
          select: { id: true, number: true, title: true, currency: true, total: true, amountPaid: true, dueDate: true, company: { select: { name: true } } },
        }),
        db.payment.findMany({ where: { invoice: v.invoice, paidAt: { gte: monthStart } }, select: { amount: true, invoice: { select: { currency: true } } } }),
      ])
    : [[], []];
  const startOfToday = colomboDayBounds(now).start;
  const overdueInvoices = unpaidInvoices.filter((i) => i.dueDate && i.dueDate < startOfToday);
  const [renewals, ticketCounts] = await Promise.all([
    db.contract.findMany({
      where: { status: "ACTIVE", endDate: { not: null, lte: in45 } },
      orderBy: { endDate: "asc" },
      take: 6,
      select: { id: true, number: true, title: true, status: true, endDate: true, renewalNoticeDays: true, company: { select: { name: true } } },
    }),
    Promise.all([
      db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] } } }),
      db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] }, assignedToId: user.id } }),
      db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] }, firstResponseAt: null, responseDueAt: { lt: now } } }),
      db.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] }, priority: "URGENT" } }),
    ]),
  ]);
  const [openTickets, myTickets, overdueTickets, urgentTickets] = ticketCounts;

  const [myTasks, myTaskCount, waitingCount, overdueCount, waitingLeads, openLeadCount, openDeals, wonThisMonth, customerCount, recentWins] = await Promise.all([
    db.activity.findMany({ where: myTasksWhere, select: activitySelect, orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }], take: 6 }),
    db.activity.count({ where: myTasksWhere }),
    db.lead.count({ where: waitingWhere }),
    db.lead.count({ where: { ...waitingWhere, respondBy: { lt: now } } }),
    db.lead.findMany({
      where: waitingWhere,
      orderBy: [{ respondBy: "asc" }],
      take: 6,
      select: { id: true, title: true, contactName: true, source: true, respondBy: true, respondedAt: true },
    }),
    db.lead.count({ where: { AND: [v.lead], status: { in: OPEN_LEAD_STATUSES } } }),
    db.deal.findMany({ where: { AND: [v.deal], status: "OPEN", pipelineId: pipeline.id }, select: { stageId: true, value: true, currency: true } }),
    db.deal.findMany({ where: { AND: [v.deal], status: "WON", closedAt: { gte: monthStart } }, select: { value: true, currency: true } }),
    db.company.count({ where: { type: "CUSTOMER" } }),
    db.deal.findMany({
      where: { AND: [v.deal], status: "WON" },
      orderBy: { closedAt: "desc" },
      take: 5,
      select: { id: true, title: true, value: true, currency: true, closedAt: true, company: { select: { name: true } } },
    }),
  ]);

  const stageRows = pipeline.openStages.map((stage) => {
    const deals = openDeals.filter((d) => d.stageId === stage.id);
    return { id: stage.id, name: stage.name, count: deals.length, total: formatMoneyTotals(deals) };
  });
  const maxCount = Math.max(1, ...stageRows.map((s) => s.count));

  const stats = [
    {
      label: "Leads waiting for a reply",
      value: waitingCount.toString(),
      sub: overdueCount ? `${overdueCount} overdue` : `${openLeadCount} open leads`,
      icon: overdueCount ? AlertTriangle : Target,
      alert: overdueCount > 0,
      href: "/leads?tab=needs-reply",
    },
    { label: "Open pipeline", value: formatMoneyTotals(openDeals), sub: `${openDeals.length} open deals`, icon: Briefcase, href: "/deals" },
    { label: "Won this month", value: formatMoneyTotals(wonThisMonth), sub: `${wonThisMonth.length} deals`, icon: Trophy, href: "/deals?view=list&status=WON" },
    { label: "Customers", value: customerCount.toLocaleString(), sub: "Companies we've worked with", icon: Handshake, href: "/companies?type=CUSTOMER" },
  ];

  return (
    <>
      {denied && (
        <div role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You don&apos;t have access to that page. Ask an admin if you need it.
        </div>
      )}
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Here's what's happening across Softro's clients today." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className={cn("h-full p-5 transition-shadow hover:shadow-md", stat.alert && "border-red-200 bg-red-50/40")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-500">{stat.label}</p>
                  <Icon className={cn("size-5", stat.alert ? "text-red-500" : "text-ink-400")} aria-hidden />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">{stat.value}</p>
                <p className={cn("mt-1 text-xs", stat.alert ? "font-medium text-red-600" : "text-ink-500")}>{stat.sub}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`My tasks for today (${myTaskCount})`}
            description="Overdue and due today, assigned to you."
            action={<Link href="/activities" className="text-xs font-medium text-brand-700 hover:underline">All activities</Link>}
          />
          {myTasks.length ? (
            <ul className="divide-y divide-ink-100">
              {myTasks.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type];
                const overdue = a.dueAt && a.dueAt < now;
                return (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <DoneCheckbox id={a.id} done={false} canToggle label={a.subject} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-ink-900">
                        <Icon className="size-4 shrink-0 text-ink-400" aria-hidden /> {a.subject}
                      </p>
                      <p className={cn("text-xs", overdue ? "font-medium text-red-600" : "text-ink-500")}>
                        {a.dueAt ? `${overdue ? "Overdue · " : ""}${formatWhen(a.dueAt)}` : "No due date"}
                      </p>
                      <ActivityContext activity={a} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">Nothing due today. Schedule follow-ups from any lead or deal.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Reply within 2 working days"
            description="Leads nobody has replied to yet, most urgent first."
            action={<Link href="/leads?tab=needs-reply" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>}
          />
          {waitingLeads.length ? (
            <ul className="divide-y divide-ink-100">
              {waitingLeads.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{lead.title}</p>
                      <p className="text-xs text-ink-500">
                        {[lead.contactName, LEAD_SOURCE_LABELS[lead.source]].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ReplyBadge respondBy={lead.respondBy} respondedAt={lead.respondedAt} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">All caught up. Every lead has had a reply.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Pipeline by stage" action={<Link href="/deals" className="text-xs font-medium text-brand-600 hover:underline">Open board</Link>} />
          <CardBody className="space-y-4">
            {stageRows.map((stage) => (
              <div key={stage.id}>
                <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-ink-700">{stage.name}</span>
                  <span className="text-xs text-ink-500">
                    {stage.count} {stage.count === 1 ? "deal" : "deals"} · {stage.total}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-ink-100">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(stage.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Contracts ending soon" description="Active contracts ending in the next 45 days." action={<Link href="/contracts?tab=renew" className="text-xs font-medium text-brand-700 hover:underline">All renewals</Link>} />
          {renewals.length ? (
            <ul className="divide-y divide-ink-100">
              {renewals.map((c) => (
                <li key={c.id}>
                  <Link href={`/contracts/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">{c.title}</span>
                      <span className="text-xs text-ink-500">{c.company.name} · ends {formatDate(c.endDate)}</span>
                    </span>
                    <ContractStateBadge contract={c} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">No contracts ending in the next 45 days.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Support" action={<Link href="/support" className="text-xs font-medium text-brand-700 hover:underline">Open support</Link>} />
          <div className="grid grid-cols-2 gap-px bg-ink-100">
            {[
              { label: "Open tickets", value: openTickets, href: "/support" },
              { label: "Assigned to me", value: myTickets, href: "/support?tab=mine" },
              { label: "Reply overdue", value: overdueTickets, href: "/support?tab=overdue", alert: overdueTickets > 0 },
              { label: "Urgent", value: urgentTickets, href: "/support?priority=URGENT", alert: urgentTickets > 0 },
            ].map((s) => (
              <Link key={s.label} href={s.href} className={cn("bg-white px-5 py-4 hover:bg-ink-50", s.alert && "bg-red-50/60")}>
                <p className="text-xs text-ink-500">{s.label}</p>
                <p className={cn("mt-1 text-2xl font-semibold", s.alert ? "text-red-600" : "text-ink-900")}>{s.value}</p>
              </Link>
            ))}
          </div>
        </Card>

        {showMoney && (
          <Card>
            <CardHeader title="Money owed to us" action={<Link href="/invoices" className="text-xs font-medium text-brand-700 hover:underline">All invoices</Link>} />
            <div className="grid grid-cols-2 gap-px bg-ink-100">
              <Link href="/invoices" className="bg-white px-5 py-4 hover:bg-ink-50">
                <p className="text-xs text-ink-500">Unpaid ({unpaidInvoices.length})</p>
                <p className="mt-1 text-lg font-semibold text-ink-900 tabular-nums">{unpaidInvoices.length ? formatMoneyTotals(unpaidInvoices.map((i) => ({ value: balanceDue(i), currency: i.currency }))) : "Nothing"}</p>
              </Link>
              <Link href="/invoices?tab=paid" className="bg-white px-5 py-4 hover:bg-ink-50">
                <p className="text-xs text-ink-500">Received this month</p>
                <p className="mt-1 text-lg font-semibold text-ink-900 tabular-nums">{receivedThisMonth.length ? formatMoneyTotals(receivedThisMonth.map((p) => ({ value: p.amount, currency: p.invoice.currency }))) : "Nothing yet"}</p>
              </Link>
            </div>
            {overdueInvoices.length ? (
              <ul className="divide-y divide-ink-100 border-t border-ink-100">
                {overdueInvoices.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <Link href={`/invoices/${i.id}`} className="flex items-center justify-between gap-4 px-5 py-2.5 hover:bg-ink-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-900">{i.company?.name ?? i.title}</span>
                        <span className="text-xs text-ink-500">{i.number} · due {formatDate(i.dueDate)}</span>
                      </span>
                      <Badge tone="red">{formatMoney(balanceDue(i), i.currency)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="border-t border-ink-100 text-sm text-ink-500">Nothing overdue.</CardBody>
            )}
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader title="Recent wins" />
          {recentWins.length ? (
            <ul className="divide-y divide-ink-100">
              {recentWins.map((deal) => (
                <li key={deal.id}>
                  <Link href={`/deals/${deal.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{deal.title}</p>
                      <p className="text-xs text-ink-500">{[deal.company?.name, `Won ${formatDate(deal.closedAt)}`].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Badge tone="green">{formatMoney(deal.value, deal.currency)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">No won deals yet. Your first one will show up here.</CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
