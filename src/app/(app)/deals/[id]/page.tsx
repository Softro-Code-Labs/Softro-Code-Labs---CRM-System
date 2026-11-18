import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, KeyRound, Mail, Pencil, Phone, Plus, Target, User } from "lucide-react";
import { checkState } from "@/lib/project-access";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { DEAL_STATUS_TONE, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE, SERVICE_TYPE_LABELS } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { deleteDeal } from "../actions";
import { CloseDealButtons, StageBar } from "./deal-controls";
import { ContractStateBadge } from "@/components/crm/contract-state-badge";
import { RecordTimeline } from "@/components/crm/record-timeline";
import { InvoicesCard, invoiceCardSelect } from "@/components/crm/invoices-card";

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
      access: { select: { id: true, status: true, googleEmail: true, lastCheckedAt: true, createdAt: true, _count: { select: { services: true } } } },
      contracts: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, title: true, status: true, endDate: true, renewalNoticeDays: true } },
      quotes: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, title: true, status: true, total: true, currency: true, issueDate: true } },
      invoices: { orderBy: { createdAt: "desc" }, select: invoiceCardSelect },
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
          <Card>
            <CardHeader
              title={`Quotes (${deal.quotes.length})`}
              action={
                can(user.role, "quote:create") && (
                  <LinkButton href={`/quotes/new?dealId=${deal.id}`} size="sm" variant="secondary">
                    <Plus className="size-4" aria-hidden /> New quote
                  </LinkButton>
                )
              }
            />
            {deal.quotes.length ? (
              <ul className="divide-y divide-ink-100">
                {deal.quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quotes/${q.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{q.title}</p>
                        <p className="font-mono text-xs text-ink-500">
                          {q.number} · {formatDate(q.issueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tabular-nums">{formatMoney(q.total, q.currency)}</span>
                        <Badge tone={QUOTE_STATUS_TONE[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="text-sm text-ink-500">No quotes yet. Create one when the client is ready for prices.</CardBody>
            )}
          </Card>
          {can(user.role, "invoice:view") && (deal.invoices.length > 0 || deal.status === "WON") && (
            <InvoicesCard
              invoices={deal.invoices}
              empty="No invoices yet. Accept a quote and invoice it from the quote's page, or create one here."
              action={
                can(user.role, "invoice:create") && (
                  <LinkButton href={`/invoices/new?dealId=${deal.id}`} size="sm" variant="secondary">
                    <Plus className="size-4" aria-hidden /> New invoice
                  </LinkButton>
                )
              }
            />
          )}
          {can(user.role, "access:view") && (deal.status === "WON" || deal.access) && (
            <Card>
              <CardHeader
                title="Project access"
                description={
                  deal.access
                    ? `${deal.access.googleEmail ?? "No project Gmail yet"} · ${deal.access._count.services} ${deal.access._count.services === 1 ? "service" : "services"}${deal.access.status === "ARCHIVED" ? " · archived" : ""}`
                    : "Record the project's Google account and the services made with it, so it's easy to pick up again later."
                }
                action={
                  <LinkButton href={`/deals/${deal.id}/access`} size="sm" variant="secondary">
                    <KeyRound className="size-4" aria-hidden /> {deal.access ? "Open" : "Set up"}
                  </LinkButton>
                }
              />
              {deal.access && ["never", "overdue"].includes(checkState(deal.access).state) && (
                <CardBody className="text-sm font-medium text-red-600">The project Gmail needs its 6-monthly sign-in check.</CardBody>
              )}
            </Card>
          )}
          {(deal.status === "WON" || deal.contracts.length > 0) && (
            <Card>
              <CardHeader
                title={`Ongoing contracts (${deal.contracts.length})`}
                description={deal.contracts.length ? undefined : "Project won. Set up maintenance, hosting or support so renewals are tracked."}
                action={
                  can(user.role, "contract:manage") &&
                  deal.companyId && (
                    <LinkButton href={`/contracts/new?dealId=${deal.id}`} size="sm" variant="secondary">
                      <Plus className="size-4" aria-hidden /> New contract
                    </LinkButton>
                  )
                }
              />
              {deal.contracts.length > 0 ? (
                <ul className="divide-y divide-ink-100">
                  {deal.contracts.map((c) => (
                    <li key={c.id}>
                      <Link href={`/contracts/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                        <span className="truncate text-sm font-medium text-ink-900">
                          <span className="font-mono text-xs text-ink-500">{c.number}</span> {c.title}
                        </span>
                        <ContractStateBadge contract={c} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : !deal.companyId ? (
                <CardBody className="text-sm text-ink-500">Link this deal to a company first; contracts belong to a company.</CardBody>
              ) : null}
            </Card>
          )}
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
