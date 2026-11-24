import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { canSee } from "@/lib/visibility";
import { getQuote } from "@/lib/quotes";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteEditor } from "../../quote-editor";
import { getEditorOptions, itemsForEditor } from "../../editor-data";
import { saveQuote } from "../../actions";

export const metadata: Metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("quote:update");
  const { id } = await params;
  const [quote, options] = await Promise.all([getQuote(id), getEditorOptions(user)]);
  if (!quote || !(await canSee(user, "quote", id))) notFound();
  if (quote.status === "ACCEPTED" || quote.status === "DECLINED") redirect(`/quotes/${id}`);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Edit ${quote.number}`}
        description={quote.status === "SENT" ? "This quote was already sent. If you change it, send the client the new PDF." : undefined}
        breadcrumbs={[{ label: "Quotes", href: "/quotes" }, { label: quote.number, href: `/quotes/${quote.id}` }, { label: "Edit" }]}
      />
      <QuoteEditor
        action={saveQuote.bind(null, quote.id)}
        isEdit
        initial={{
          title: quote.title,
          currency: quote.currency,
          issueDate: toDateInput(quote.issueDate),
          validUntil: toDateInput(quote.validUntil),
          dealId: quote.dealId ?? "",
          companyId: quote.companyId ?? "",
          contactId: quote.contactId ?? "",
          introduction: quote.introduction ?? "",
          terms: quote.terms ?? "",
          notes: quote.notes ?? "",
          discountPercent: quote.discountPercent.toString(),
          taxLabel: quote.taxLabel,
          taxRate: quote.taxRate.toString(),
        }}
        initialItems={itemsForEditor(quote)}
        {...options}
        cancelHref={`/quotes/${quote.id}`}
      />
    </div>
  );
}
