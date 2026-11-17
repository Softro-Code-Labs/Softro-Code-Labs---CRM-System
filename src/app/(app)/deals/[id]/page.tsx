import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Mail, Pencil, Phone, Target, User } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { DEAL_STATUS_TONE, SERVICE_TYPE_LABELS } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { deleteDeal } from "../actions";
import { CloseDealButtons, StageBar } from "./deal-controls";
import { RecordTimeline } from "@/components/crm/record-timeline";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const deal = await db.deal.findUnique({ where: { id }, select: { title: true } });
  return { title: deal?.title ?? "Deal" };
}

export default async function DealPage({ params }: Props) {
  const user = await requirePermission("deal:view");
  const { id } = await params;
  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      pipeline: { include: { stages: { where: { isWon: false, isLost: false }, orderBy: { position: "asc" } } } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, jobTitle: true } },
      owner: { select: { name: true } },
      lead: { select: { id: true, title: true, createdAt: true } },
    },
  });
  if (!deal) notFound();
  const canEdit = can(user.role, "deal:update");

  const details: [string, React.ReactNode][] = [
    ["Service", deal.serviceType ? SERVICE_TYPE_LABELS[deal.serviceType] : null],
    ["Owner", deal.owner?.name],
    ["Expected close", formatDate(deal.expectedCloseDate)],
    ["Win probability", deal.status === "OPEN" ? `${deal.stage.probability}%` : null],
    [deal.status === "WON" ? "Won on" : deal.status === "LOST" ? "Lost on" : "Closed", deal.closedAt ? formatDate(deal.closedAt) : null],
    ["Created", formatDate(deal.createdAt)],
  ];

  return (
    <>
      <PageHeader
        title={deal.title}
        breadcrumbs={[{ label: "Deals", href: "/deals" }, { label: deal.title }]}
        actions={
          <>
            {can(user.role, "deal:delete") && <ConfirmDelete action={deleteDeal.bind(null, deal.id)} />}
            {canEdit && (
              <LinkButton href={`/deals/${deal.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <p className="text-2xl font-semibold text-ink-900 tabular-nums">{formatMoney(deal.value, deal.currency)}</p>
        <Badge tone={DEAL_STATUS_TONE[deal.status]}>{deal.status === "OPEN" ? deal.stage.name : deal.status === "WON" ? "Won" : "Lost"}</Badge>
        {deal.status === "LOST" && deal.lostReason && <span className="text-sm text-ink-500">Reason: {deal.lostReason}</span>}
        <div className="ml-auto">
          <CloseDealButtons dealId={deal.id} status={deal.status} canEdit={canEdit} />
        </div>
      </div>

      <div className="mb-6">
        <StageBar
          dealId={deal.id}
          stages={deal.pipeline.stages.map((s) => ({ id: s.id, name: s.name }))}
          currentStageId={deal.stageId}
          status={deal.status}
          canEdit={canEdit}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Scope & notes" />
            <CardBody className="text-sm whitespace-pre-line text-ink-700">{deal.description || <span className="text-ink-400">No scope written yet.</span>}</CardBody>
          </Card>
          <RecordTimeline target={{ leadId: null, dealId: deal.id, companyId: null, contactId: null }} user={user} />
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Client</h2>
            {deal.company ? (
              <Link href={`/companies/${deal.company.id}`} className="flex items-center gap-2 text-sm font-medium text-ink-800 hover:text-brand-700">
                <Building2 className="size-4 text-ink-400" aria-hidden /> {deal.company.name}
              </Link>
            ) : (
              <p className="text-sm text-ink-500">No company linked.</p>
            )}
            {deal.contact && (
              <div className="mt-4 border-t border-ink-100 pt-4 text-sm">
                <Link href={`/contacts/${deal.contact.id}`} className="flex items-center gap-2 font-medium text-ink-800 hover:text-brand-700">
                  <User className="size-4 text-ink-400" aria-hidden /> {fullName(deal.contact)}
                </Link>
                {deal.contact.jobTitle && <p className="ml-6 text-xs text-ink-500">{deal.contact.jobTitle}</p>}
                <ul className="mt-2 ml-6 space-y-1 text-ink-600">
                  {deal.contact.email && (
                    <li>
                      <a href={`mailto:${deal.contact.email}`} className="flex items-center gap-1.5 hover:text-brand-700">
                        <Mail className="size-3.5" aria-hidden /> {deal.contact.email}
                      </a>
                    </li>
                  )}
                  {(deal.contact.mobile ?? deal.contact.phone) && (
                    <li>
                      <a href={`tel:${deal.contact.mobile ?? deal.contact.phone}`} className="flex items-center gap-1.5 hover:text-brand-700">
                        <Phone className="size-3.5" aria-hidden /> {deal.contact.mobile ?? deal.contact.phone}
                      </a>
                    </li>
                  )}
                </ul>
                <div className="mt-3 ml-6">
                  <WhatsAppButton phone={deal.contact.mobile ?? deal.contact.phone} size="sm" />
                </div>
              </div>
            )}
          </Card>
          <Card>
            <dl className="divide-y divide-ink-100">
              {details.filter(([, v]) => v !== null).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="text-right font-medium text-ink-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {deal.lead && (
            <Link href={`/leads/${deal.lead.id}`} className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600 shadow-sm hover:text-brand-700">
              <Target className="size-4" aria-hidden /> From lead received {formatDate(deal.lead.createdAt)}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
