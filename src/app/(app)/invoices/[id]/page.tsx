import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, toDateInput } from "@/lib/utils";
import { getOrgSettings } from "@/lib/queries/org";
import { balanceDue, getInvoice, invoiceState, isEditable } from "@/lib/invoices";
import { INVOICE_STATE_LABELS, INVOICE_STATE_TONE, PAYMENT_METHOD_LABELS } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/crm/invoice-document";
import { CancelPaymentButton, PaymentForm, VoidButton } from "./invoice-controls";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: inv?.number ?? "Invoice" };
}

export default async function InvoicePage({ params }: Props) {
  const user = await requirePermission("invoice:view");
  const { id } = await params;
  const [invoice, org] = await Promise.all([getInvoice(id), getOrgSettings()]);
  if (!invoice) notFound();
  const state = invoiceState(invoice);
  const balance = balanceDue(invoice);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${invoice.number} · ${invoice.title}`}
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: invoice.number }]}
        actions={
          <>
            {invoice.status === "ISSUED" && Number(invoice.amountPaid) === 0 && can(user.role, "invoice:void") && <VoidButton id={invoice.id} />}
            {isEditable(invoice) && can(user.role, "invoice:update") && (
              <LinkButton href={`/invoices/${invoice.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
            <LinkButton href={`/invoices/${invoice.id}/pdf?download=1`}>
              <FileDown className="size-4" aria-hidden /> Download PDF
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <InvoiceDocument invoice={invoice} org={org} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <Badge tone={INVOICE_STATE_TONE[state]}>{INVOICE_STATE_LABELS[state]}</Badge>
                {invoice.dueDate && state !== "paid" && state !== "void" && <span className="text-xs text-ink-500">Due {formatDate(invoice.dueDate)}</span>}
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Total</span>
                <span className="font-medium tabular-nums">{formatMoney(invoice.total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Received</span>
                <span className="tabular-nums">{formatMoney(invoice.amountPaid, invoice.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-semibold">
                <span>Balance</span>
                <span className={state === "overdue" ? "text-red-600 tabular-nums" : "tabular-nums"}>{formatMoney(Math.max(balance, 0), invoice.currency)}</span>
              </div>
            </CardBody>
          </Card>

          {invoice.status === "ISSUED" && can(user.role, "payment:record") && (
            <Card>
              <CardHeader title="Record a payment" description="Makes a numbered receipt you can send the client." />
              <CardBody>
                <PaymentForm invoiceId={invoice.id} balance={balance.toFixed(2)} today={toDateInput(new Date())} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={`Payments (${invoice.payments.length})`} />
            {invoice.payments.length ? (
              <ul className="divide-y divide-ink-100">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium text-ink-900 tabular-nums">{formatMoney(p.amount, invoice.currency)}</span>
                      <span className="block text-xs text-ink-500">
                        {formatDate(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                        {p.reference && ` · ${p.reference}`}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <a href={`/receipts/${p.id}/pdf`} target="_blank" rel="noopener" className="font-mono text-xs whitespace-nowrap text-brand-700 hover:underline">
                        {p.receiptNumber}
                      </a>
                      {can(user.role, "payment:delete") && <CancelPaymentButton id={p.id} receipt={p.receiptNumber} />}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="text-sm text-ink-500">Nothing received yet.</CardBody>
            )}
          </Card>

          <Card className="space-y-1.5 p-5 text-sm">
            {invoice.deal && (
              <p>
                <span className="text-ink-500">Deal: </span>
                <Link href={`/deals/${invoice.deal.id}`} className="text-brand-700 hover:underline">{invoice.deal.title}</Link>
              </p>
            )}
            {invoice.quote && (
              <p>
                <span className="text-ink-500">From quote: </span>
                <Link href={`/quotes/${invoice.quote.id}`} className="text-brand-700 hover:underline">{invoice.quote.number}</Link>
              </p>
            )}
            {invoice.contract && (
              <p>
                <span className="text-ink-500">Contract: </span>
                <Link href={`/contracts/${invoice.contract.id}`} className="text-brand-700 hover:underline">{invoice.contract.number}</Link>
              </p>
            )}
            {invoice.createdBy && <p className="text-ink-500">Created by {invoice.createdBy.name} on {formatDate(invoice.createdAt)}</p>}
            {invoice.notes && <p className="border-t border-ink-100 pt-2 whitespace-pre-line text-ink-600">{invoice.notes}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
