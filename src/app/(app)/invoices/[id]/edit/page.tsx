import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getInvoice, isEditable } from "@/lib/invoices";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteEditor } from "../../../quotes/quote-editor";
import { getEditorOptions } from "../../../quotes/editor-data";
import { saveInvoice } from "../../actions";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("invoice:update");
  const { id } = await params;
  const [invoice, options] = await Promise.all([getInvoice(id), getEditorOptions()]);
  if (!invoice) notFound();
  if (!isEditable(invoice)) redirect(`/invoices/${id}`);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Edit ${invoice.number}`}
        description="If the client already has this invoice, send them the new PDF."
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: invoice.number, href: `/invoices/${invoice.id}` }, { label: "Edit" }]}
      />
      <QuoteEditor
        kind="invoice"
        isEdit
        contractId={invoice.contractId}
        action={saveInvoice.bind(null, invoice.id)}
        initial={{
          title: invoice.title,
          currency: invoice.currency,
          issueDate: toDateInput(invoice.issueDate),
          validUntil: toDateInput(invoice.dueDate),
          dealId: invoice.dealId ?? "",
          companyId: invoice.companyId ?? "",
          contactId: invoice.contactId ?? "",
          introduction: "",
          terms: invoice.terms ?? "",
          notes: invoice.notes ?? "",
          discountPercent: invoice.discountPercent.toString(),
          taxLabel: invoice.taxLabel,
          taxRate: invoice.taxRate.toString(),
        }}
        initialItems={invoice.items.map((i) => ({
          key: i.id,
          productId: null,
          title: i.title,
          description: i.description ?? "",
          quantity: i.quantity.toString(),
          unit: i.unit,
          unitPrice: i.unitPrice.toString(),
          discountPercent: i.discountPercent.toString(),
        }))}
        {...options}
        cancelHref={`/invoices/${invoice.id}`}
      />
    </div>
  );
}
