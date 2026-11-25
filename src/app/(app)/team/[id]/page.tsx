import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { avatarUrl } from "@/lib/avatar";
import { formatDate, formatMoney, formatMoneyTotals } from "@/lib/utils";
import { ACTIVITY_TYPE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE, OPEN_LEAD_STATUSES, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/crm-meta";
import { getTeamMember, getWorkload } from "@/lib/team";
import { getAssignableOwners } from "@/lib/visibility";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { StatTile } from "@/components/reports/charts";
import { ReplyBadge } from "@/components/crm/reply-badge";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { HandOverForm } from "./hand-over-form";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { name: true } });
  return { title: u?.name ?? "Team member" };
}

export default async function TeamMemberPage({ params }: Props) {
  const user = await requirePermission("team:view");
  const { id } = await params;
  const member = await getTeamMember(user, id);
  if (!member) notFound();
  const now = new Date();

  const [work, leads, deals, quotes, tasks, owners] = await Promise.all([
    getWorkload([member.id], now).then((m) => m.get(member.id)!),
    db.lead.findMany({
      where: { ownerId: member.id, status: { in: OPEN_LEAD_STATUSES } },
      orderBy: [{ respondedAt: { sort: "desc", nulls: "first" } }, { respondBy: "asc" }],
      take: 15,
      select: { id: true, title: true, status: true, respondBy: true, respondedAt: true, companyName: true, contactName: true },
    }),
    db.deal.findMany({
      where: { ownerId: member.id, status: "OPEN" },
      orderBy: { stageChangedAt: "asc" },
      take: 15,
      select: { id: true, title: true, value: true, currency: true, expectedCloseDate: true, stage: { select: { name: true } }, company: { select: { name: true } } },
    }),
    db.quote.findMany({
      where: { createdById: member.id, status: { in: ["DRAFT", "SENT"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, number: true, title: true, status: true, total: true, currency: true },
    }),
    db.activity.findMany({
      where: { assignedToId: member.id, completedAt: null },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }],
      take: 10,
      select: { id: true, type: true, subject: true, dueAt: true, leadId: true, dealId: true, companyId: true, contactId: true },
    }),
    getAssignableOwners(user),
  ]);
  const handOverTo = owners.filter((o) => o.id !== member.id);
  const taskHref = (t: (typeof tasks)[number]) =>
    t.dealId ? `/deals/${t.dealId}` : t.leadId ? `/leads/${t.leadId}` : t.companyId ? `/companies/${t.companyId}` : t.contactId ? `/contacts/${t.contactId}` : "/activities";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={member.name}
        breadcrumbs={[{ label: user.role === "ADMIN" ? "Teams" : "My team", href: "/team" }, { label: member.name }]}
        actions={
          user.role === "ADMIN" && (
            <LinkButton href={`/settings/users/${member.id}`} variant="secondary">
              <Pencil className="size-4" aria-hidden /> Edit account
            </LinkButton>
          )
        }
      />

      <Card className="flex flex-wrap items-center gap-5 p-5">
        <Avatar name={member.name} src={avatarUrl(member)} className="size-16 text-lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink-900">
            {member.name}
            <Badge tone="gray">{ROLE_LABELS[member.role]}</Badge>
            {!member.isActive && <Badge tone="red">Deactivated</Badge>}
          </p>
          <p className="text-sm text-ink-600">{[member.jobTitle, member.manager && `Team of ${member.manager.name}`].filter(Boolean).join(" · ")}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 text-ink-700 hover:text-brand-700">
              <Mail className="size-4 text-ink-400" aria-hidden /> {member.email}
            </a>
            {member.phone && (
              <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 text-ink-700 hover:text-brand-700">
                <Phone className="size-4 text-ink-400" aria-hidden /> {member.phone}
              </a>
            )}
            <span className="text-ink-500">Last sign-in: {member.lastLoginAt ? formatDate(member.lastLoginAt) : "never"}</span>
          </p>
        </div>
        <WhatsAppButton phone={member.phone} size="sm" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open leads" value={work.leads} />
        <StatTile label="Open deals" value={work.deals} hint={work.deals ? formatMoneyTotals(work.pipeline) : undefined} />
        <StatTile label="Quotes with clients" value={work.quotes} />
        <StatTile label="Overdue tasks" value={work.overdue} tone={work.overdue ? "bad" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Open leads (${work.leads})`} />
          {leads.length ? (
            <ul className="divide-y divide-ink-100">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-ink-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{l.title}</span>
                      <span className="block truncate text-xs text-ink-500">{[l.contactName, l.companyName].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                      <ReplyBadge respondBy={l.respondBy} respondedAt={l.respondedAt} compact />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">No open leads.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title={`Open deals (${work.deals})`} />
          {deals.length ? (
            <ul className="divide-y divide-ink-100">
              {deals.map((d) => (
                <li key={d.id}>
                  <Link href={`/deals/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-ink-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{d.title}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {[d.company?.name, d.stage.name, d.expectedCloseDate && `close ${formatDate(d.expectedCloseDate)}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(d.value, d.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">No open deals.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Quotes in progress" description="Drafts and quotes waiting for the client's answer." />
          {quotes.length ? (
            <ul className="divide-y divide-ink-100">
              {quotes.map((q) => (
                <li key={q.id}>
                  <Link href={`/quotes/${q.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-ink-50">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-ink-500">{q.number}</span> {q.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{formatMoney(q.total, q.currency)}</span>
                      <Badge tone={QUOTE_STATUS_TONE[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">No quotes in progress.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Tasks to do" description="Calls, meetings and tasks assigned to them, soonest first." />
          {tasks.length ? (
            <ul className="divide-y divide-ink-100">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link href={taskHref(t)} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-ink-50">
                    <span className="min-w-0 truncate">
                      <span className="text-xs text-ink-500">{ACTIVITY_TYPE_LABELS[t.type]}:</span> {t.subject}
                    </span>
                    <span className={t.dueAt && t.dueAt < now ? "shrink-0 text-xs font-medium text-red-600" : "shrink-0 text-xs text-ink-500"}>
                      {t.dueAt ? formatDate(t.dueAt) : "No date"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-ink-500">Nothing to do.</CardBody>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Hand over their work" description="Moves their open leads, open deals and unfinished tasks to someone else in the team in one go." />
        <CardBody>
          <HandOverForm memberId={member.id} memberName={member.name} people={handOverTo} />
        </CardBody>
      </Card>
    </div>
  );
}
