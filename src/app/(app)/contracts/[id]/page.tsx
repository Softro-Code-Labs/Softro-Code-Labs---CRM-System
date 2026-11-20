import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building2, LifeBuoy, Pencil, Plus, User } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getContract, monthlyValue } from "@/lib/contracts";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { BILLING_CYCLE_SHORT, CONTRACT_TYPE_LABELS, TICKET_STATUS_LABELS, TICKET_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { ContractStateBadge } from "@/components/crm/contract-state-badge";
import { deleteContract } from "../actions";
import { ContractActions } from "./contract-actions";
import { InvoiceContractButton } from "./invoice-contract-button";
import { InvoicesCard, invoiceCardSelect } from "@/components/crm/invoices-card";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await db.contract.findUnique({ where: { id }, select: { number: true, title: true } });
  return { title: c ? `${c.number} ${c.title}` : "Contract" };
}

export default async function ContractPage({ params }: Props) {
  const user = await requirePermission("contract:view");
  const { id } = await params;
  const [c, tickets, invoices] = await Promise.all([
    getContract(id),
    db.ticket.findMany({ where: { contractId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, subject: true, status: true, createdAt: true } }),
    can(user.role, "invoice:view") ? db.invoice.findMany({ where: { contractId: id }, orderBy: { createdAt: "desc" }, take: 24, select: invoiceCardSelect }) : [],
  ]);
  if (!c) notFound();
  const canManage = can(user.role, "contract:manage");
  const monthly = monthlyValue(c.amount, c.billingCycle);

  const details: [string, React.ReactNode][] = [
    ["Type", CONTRACT_TYPE_LABELS[c.type]],
    ["Price", `${formatMoney(c.amount, c.currency)} ${BILLING_CYCLE_SHORT[c.billingCycle]}`],
    ["Monthly value", c.billingCycle === "ONE_TIME" ? "—" : formatMoney(monthly, c.currency)],
    ["Period", `${formatDate(c.startDate)} → ${c.endDate ? formatDate(c.endDate) : "until cancelled"}`],
    ["Renewal reminder", c.endDate ? `${c.renewalNoticeDays} days before the end` : "—"],
    ["Usually renews", c.autoRenew ? "Yes" : "No"],
    ["First response", c.responseTimeHours ? `within ${c.responseTimeHours} hours` : "Standard times"],
    ["Hours included", c.includedHours ? `${Number(c.includedHours)} / month` : "—"],
    ["Owner", c.owner?.name],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${c.number} · ${c.title}`}
        breadcrumbs={[{ label: "Contracts", href: "/contracts" }, { label: c.number }]}
        actions={
          <>
            {can(user.role, "contract:delete") && <ConfirmDelete action={deleteContract.bind(null, c.id)} title={`Delete contract ${c.number}?`} body="To end it but keep the record, use Cancel contract instead. This can't be undone." />}
            {canManage && c.status !== "ENDED" && (
              <LinkButton href={`/contracts/${c.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <ContractStateBadge contract={c} />
          <Link href={`/companies/${c.company.id}`} className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-brand-700">
            <Building2 className="size-4" aria-hidden /> {c.company.name}
          </Link>
          {c.contact && (
            <Link href={`/contacts/${c.contact.id}`} className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-brand-700">
              <User className="size-4" aria-hidden /> {fullName(c.contact)}
            </Link>
          )}
          {c.deal && (
            <Link href={`/deals/${c.deal.id}`} className="flex items-center gap-1.5 text-sm text-ink-700 hover:text-brand-700">
              <Briefcase className="size-4" aria-hidden /> {c.deal.title}
            </Link>
          )}
        </div>
        {canManage && <ContractActions id={c.id} status={c.status} canRenew={Boolean(c.endDate) && !c.renewedTo} />}
      </div>

      {(c.renewedFrom || c.renewedTo) && (
        <p className="mb-6 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-600">
          {c.renewedFrom && (
            <>
              Renewal of{" "}
              <Link href={`/contracts/${c.renewedFrom.id}`} className="font-medium text-brand-700 hover:underline">
                {c.renewedFrom.number}
              </Link>
              .{" "}
            </>
          )}
          {c.renewedTo && (
            <>
              Renewed as{" "}
              <Link href={`/contracts/${c.renewedTo.id}`} className="font-medium text-brand-700 hover:underline">
                {c.renewedTo.number}
              </Link>
              .
            </>
          )}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="What's covered" />
            <CardBody className="text-sm whitespace-pre-line text-ink-700">{c.scope || <span className="text-ink-400">Not written yet.</span>}</CardBody>
          </Card>
          <Card>
            <CardHeader
              title={`Support tickets (${tickets.length})`}
              action={
                can(user.role, "ticket:create") && (
                  <LinkButton href={`/support/new?contractId=${c.id}`} size="sm" variant="secondary">
                    <Plus className="size-4" aria-hidden /> New ticket
                  </LinkButton>
                )
              }
            />
            {tickets.length ? (
              <ul className="divide-y divide-ink-100">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/support/${t.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-900">{t.subject}</span>
                        <span className="font-mono text-xs text-ink-500">
                          {t.number} · {formatDate(t.createdAt)}
                        </span>
                      </span>
                      <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="flex items-center gap-2 text-sm text-ink-500">
                <LifeBuoy className="size-4" aria-hidden /> No tickets under this contract.
              </CardBody>
            )}
          </Card>
          {can(user.role, "invoice:view") && (
            <InvoicesCard
              invoices={invoices}
              empty="No invoices yet for this contract."
              action={can(user.role, "invoice:create") && Number(c.amount) > 0 && <InvoiceContractButton contractId={c.id} />}
            />
          )}
        </div>
        <Card>
          <dl className="divide-y divide-ink-100">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right font-medium text-ink-900">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
