import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, FileSignature, MessageSquareText, Pencil, Reply, User } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAssignableUsers } from "@/lib/queries/users";
import { fullName } from "@/lib/utils";
import { TICKET_CHANNEL_LABELS, TICKET_PRIORITY_LABELS, TICKET_PRIORITY_TONE, TICKET_STATUS_LABELS, TICKET_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { SlaBadge } from "@/components/crm/sla-badge";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { formatWhen } from "@/components/crm/record-timeline";
import { deleteTicket } from "../actions";
import { AssigneeSelect, CommentComposer, TicketStatusBar } from "./ticket-controls";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await db.ticket.findUnique({ where: { id }, select: { number: true, subject: true } });
  return { title: t ? `${t.number} ${t.subject}` : "Ticket" };
}

export default async function TicketPage({ params }: Props) {
  const user = await requirePermission("ticket:view");
  const { id } = await params;
  const [t, users] = await Promise.all([
    db.ticket.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, phone: true, mobile: true, email: true } },
        contract: { select: { id: true, number: true, title: true, responseTimeHours: true, status: true } },
        createdBy: { select: { name: true } },
        comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      },
    }),
    getAssignableUsers(),
  ]);
  if (!t) notFound();
  const canEdit = can(user.role, "ticket:update");

  const details: [string, React.ReactNode][] = [
    ["Priority", <Badge key="p" tone={TICKET_PRIORITY_TONE[t.priority]}>{TICKET_PRIORITY_LABELS[t.priority]}</Badge>],
    ["Came in by", TICKET_CHANNEL_LABELS[t.channel]],
    ["Opened", `${formatWhen(t.createdAt)}${t.createdBy ? ` by ${t.createdBy.name}` : ""}`],
    ["First reply due", t.responseDueAt ? formatWhen(t.responseDueAt) : "—"],
    ["First replied", t.firstResponseAt ? formatWhen(t.firstResponseAt) : "Not yet"],
    ["Resolved", t.resolvedAt ? formatWhen(t.resolvedAt) : "—"],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${t.number} · ${t.subject}`}
        breadcrumbs={[{ label: "Support", href: "/support" }, { label: t.number }]}
        actions={
          <>
            {can(user.role, "ticket:delete") && <ConfirmDelete action={deleteTicket.bind(null, t.id)} />}
            {canEdit && (
              <LinkButton href={`/support/${t.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <TicketStatusBar id={t.id} status={t.status} canEdit={canEdit} />
        <div className="flex items-center gap-2">
          <SlaBadge ticket={t} />
          <AssigneeSelect id={t.id} value={t.assignedToId ?? ""} users={users} canEdit={canEdit} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="The problem" />
            <CardBody className="text-sm whitespace-pre-line text-ink-700">{t.description || <span className="text-ink-400">No details.</span>}</CardBody>
          </Card>
          <Card>
            <CardHeader title={`Conversation (${t.comments.length})`} description="Replies you sent the client and internal notes, oldest first." />
            {t.comments.length > 0 && (
              <ol className="divide-y divide-ink-100">
                {t.comments.map((c) => (
                  <li key={c.id} className="flex gap-3 px-5 py-3">
                    <span className={c.isClientReply ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"}>
                      {c.isClientReply ? <Reply className="size-3.5" aria-hidden /> : <MessageSquareText className="size-3.5" aria-hidden />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm whitespace-pre-line text-ink-800">{c.body}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {c.isClientReply ? "Reply to client" : "Internal note"} · {c.author?.name ?? "Someone"} · {formatWhen(c.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {canEdit && (
              <div className="border-t border-ink-100 px-5 py-4">
                <CommentComposer id={t.id} firstReplyPending={!t.firstResponseAt} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-semibold text-ink-900">Client</h2>
            {t.company && (
              <Link href={`/companies/${t.company.id}`} className="flex items-center gap-2 text-ink-800 hover:text-brand-700">
                <Building2 className="size-4 text-ink-400" aria-hidden /> {t.company.name}
              </Link>
            )}
            {t.contact && (
              <>
                <Link href={`/contacts/${t.contact.id}`} className="mt-2 flex items-center gap-2 text-ink-800 hover:text-brand-700">
                  <User className="size-4 text-ink-400" aria-hidden /> {fullName(t.contact)}
                </Link>
                <div className="mt-3">
                  <WhatsAppButton phone={t.contact.mobile ?? t.contact.phone} size="sm" message={`Hi ${t.contact.firstName}, this is Softro Code Labs support about ticket ${t.number}: ${t.subject}.`} />
                </div>
              </>
            )}
            {t.contract ? (
              <Link href={`/contracts/${t.contract.id}`} className="mt-4 flex items-start gap-2 border-t border-ink-100 pt-3 text-ink-800 hover:text-brand-700">
                <FileSignature className="mt-0.5 size-4 text-ink-400" aria-hidden />
                <span>
                  {t.contract.number} · {t.contract.title}
                  <span className="block text-xs text-ink-500">{t.contract.responseTimeHours ? `SLA: first reply within ${t.contract.responseTimeHours} h` : "Standard response times"}</span>
                </span>
              </Link>
            ) : (
              <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-500">Not under a contract. May be billable.</p>
            )}
          </Card>
          <Card>
            <dl className="divide-y divide-ink-100">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="text-right font-medium text-ink-900">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                <dt className="text-ink-500">Status</dt>
                <dd>
                  <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
