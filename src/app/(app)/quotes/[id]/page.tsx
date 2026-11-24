import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Download, Eye, Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getQuote, isExpired } from "@/lib/quotes";
import { getOrgSettings } from "@/lib/queries/org";
import { formatDate, formatMoney } from "@/lib/utils";
import { db } from "@/lib/db";
import { invoiceState } from "@/lib/invoices";
import { INVOICE_STATE_LABELS, INVOICE_STATE_TONE, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { QuoteDocument } from "@/components/crm/quote-document";
import { deleteQuote } from "../actions";
import { QuoteStatusActions } from "./quote-actions";
import { InvoiceFromQuote } from "./invoice-from-quote";
import { SealControl } from "@/components/crm/seal-control";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const q = await getQuote(id);
  return { title: q ? `${q.number} ${q.title}` : "Quote" };
}

export default async function QuotePage({ params }: Props) {
  const user = await requirePermission("quote:view");
  const { id } = await params;
  const [quote, org] = await Promise.all([getQuote(id), getOrgSettings()]);
  if (!quote) notFound();
  const invoices = can(user.role, "invoice:view")
    ? await db.invoice.findMany({ where: { quoteId: quote.id }, orderBy: { createdAt: "asc" }, select: { id: true, number: true, title: true, status: true, dueDate: true, total: true, amountPaid: true, subtotal: true, discountTotal: true, items: { select: { title: true }, take: 1 } } })
    : [];
  const quoteNet = Number(quote.subtotal) - Number(quote.discountTotal);
  const invoicedNet = invoices.filter((i) => i.status !== "VOID").reduce((sum, i) => sum + Number(i.subtotal) - Number(i.discountTotal), 0);
  const remaining = Math.round((quoteNet - invoicedNet) * 100) / 100;

  const sealed = Boolean(quote.seal);
  const locked = quote.status === "ACCEPTED" || quote.status === "DECLINED" || sealed;
  const canEdit = can(user.role, "quote:update");
  const canDelete = !sealed && (can(user.role, "quote:delete") || (canEdit && quote.status === "DRAFT" && quote.createdById === user.id));
  const canSeal = can(user.role, "document:seal");
  const hasSignature = canSeal && Boolean((await db.user.findUnique({ where: { id: user.id }, select: { signatureUpdatedAt: true } }))?.signatureUpdatedAt);
  const expired = isExpired(quote);
  const timeline = [
    ["Created", quote.createdAt],
    ["Sent", quote.sentAt],
    ["Accepted", quote.acceptedAt],
    ["Declined", quote.declinedAt],
  ].filter(([, d]) => d) as [string, Date][];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${quote.number} · ${quote.title}`}
        breadcrumbs={[{ label: "Quotes", href: "/quotes" }, { label: quote.number }]}
        actions={
          <>
            {canDelete && <ConfirmDelete action={deleteQuote.bind(null, quote.id)} title={`Delete quote ${quote.number}?`} body="This can't be undone." />}
            {canEdit && !locked && (
              <LinkButton href={`/quotes/${quote.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
            <a href={`/quotes/${quote.id}/pdf`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <Eye className="size-4" aria-hidden /> View PDF
            </a>
            <a href={`/quotes/${quote.id}/pdf?download=1`} className={buttonClass("primary")}>
              <Download className="size-4" aria-hidden /> Download PDF
            </a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={QUOTE_STATUS_TONE[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
              {expired && <Badge tone="amber">Past valid date</Badge>}
              {quote.deal && (
                <Link href={`/deals/${quote.deal.id}`} className="flex items-center gap-1.5 text-sm text-ink-600 hover:text-brand-700">
                  <Briefcase className="size-4" aria-hidden /> {quote.deal.title}
                </Link>
              )}
            </div>
            <QuoteStatusActions
              id={quote.id}
              status={quote.status}
              canEdit={canEdit}
              canCreate={can(user.role, "quote:create")}
              hasOpenDeal={quote.deal?.status === "OPEN"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="History" />
          <ul className="space-y-1 px-5 py-3 text-sm">
            {timeline.map(([label, date]) => (
              <li key={label} className="flex justify-between">
                <span className="text-ink-500">{label}</span>
                <span className="text-ink-800">{formatDate(date)}</span>
              </li>
            ))}
            {quote.createdBy && <li className="pt-1 text-xs text-ink-500">By {quote.createdBy.name}</li>}
          </ul>
        </Card>
      </div>

      {quote.status === "ACCEPTED" && can(user.role, "invoice:view") && (
        <Card className="mb-6">
          <CardHeader
            title="Invoices"
            description={
              remaining > 0.005
                ? `${formatMoney(remaining, quote.currency)} of ${formatMoney(quoteNet, quote.currency)} still to invoice (before tax).`
                : "This quote is fully invoiced."
            }
          />
          {invoices.length > 0 && (
            <ul className="divide-y divide-ink-100 border-b border-ink-100">
              {invoices.map((inv) => {
                const state = invoiceState(inv);
                return (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-brand-700">
                      <span className="font-mono text-xs text-ink-500">{inv.number}</span> {inv.items[0]?.title ?? inv.title}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums">{formatMoney(inv.total, quote.currency)}</span>
                      <Badge tone={INVOICE_STATE_TONE[state]}>{INVOICE_STATE_LABELS[state]}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {remaining > 0.005 && can(user.role, "invoice:create") && (
            <CardBody>
              <InvoiceFromQuote quoteId={quote.id} anyInvoiced={invoicedNet > 0} remaining={formatMoney(remaining, quote.currency)} />
            </CardBody>
          )}
        </Card>
      )}

      {quote.notes && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <span className="font-semibold">Internal note: </span>
          <span className="whitespace-pre-line">{quote.notes}</span>
        </div>
      )}

      {(sealed || (canSeal && quote.status !== "DECLINED")) && (
        <div className="mb-6">
          <SealControl
            kind="quote"
            id={quote.id}
            sealed={quote.seal ? { by: quote.seal.signerName, on: formatDate(quote.seal.sealedAt) } : null}
            canSeal={canSeal}
            hasSignature={hasSignature}
          />
        </div>
      )}

      <QuoteDocument quote={quote} org={org} />
    </div>
  );
}
