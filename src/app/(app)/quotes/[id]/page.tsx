import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Download, Eye, Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getQuote, isExpired } from "@/lib/quotes";
import { getOrgSettings } from "@/lib/queries/org";
import { formatDate } from "@/lib/utils";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { QuoteDocument } from "@/components/crm/quote-document";
import { deleteQuote } from "../actions";
import { QuoteStatusActions } from "./quote-actions";

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

  const locked = quote.status === "ACCEPTED" || quote.status === "DECLINED";
  const canEdit = can(user.role, "quote:update");
  const canDelete = can(user.role, "quote:delete") || (canEdit && quote.status === "DRAFT" && quote.createdById === user.id);
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
            {canDelete && <ConfirmDelete action={deleteQuote.bind(null, quote.id)} />}
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

      {quote.notes && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <span className="font-semibold">Internal note: </span>
          <span className="whitespace-pre-line">{quote.notes}</span>
        </div>
      )}

      <QuoteDocument quote={quote} org={org} />
    </div>
  );
}
