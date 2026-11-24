import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { getOrgSettings } from "@/lib/queries/org";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteEditor } from "../../quotes/quote-editor";
import { getEditorOptions } from "../../quotes/editor-data";
import { saveInvoice } from "../actions";

export const metadata: Metadata = { title: "New invoice" };

/** A free-form invoice (extra work, hosting, anything not on a quote). Invoices from quotes and contracts are one click on those pages. */
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ dealId?: string; companyId?: string }> }) {
  const user = await requirePermission("invoice:create");
  const sp = await searchParams;
  const [org, options, deal] = await Promise.all([
    getOrgSettings(),
    getEditorOptions(user),
    sp.dealId ? db.deal.findFirst({ where: { AND: [{ id: sp.dealId }, (await getVisibility(user)).deal] }, select: { id: true, title: true, currency: true, companyId: true, contactId: true } }) : null,
  ]);
  const now = new Date();
  const companyId = deal?.companyId ?? options.companies.find((c) => c.id === sp.companyId)?.id ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="New invoice"
        description="Gets the next invoice number when you save. To invoice a quote or a contract, open it and use “Create invoice” instead."
        breadcrumbs={deal ? [{ label: "Deals", href: "/deals" }, { label: deal.title, href: `/deals/${deal.id}` }, { label: "New invoice" }] : [{ label: "Invoices", href: "/invoices" }, { label: "New" }]}
      />
      <QuoteEditor
        kind="invoice"
        action={saveInvoice.bind(null, null)}
        initial={{
          title: deal?.title ?? "",
          currency: deal?.currency ?? process.env.DEFAULT_CURRENCY ?? "LKR",
          issueDate: toDateInput(now),
          validUntil: toDateInput(new Date(now.getTime() + org.invoiceDueDays * 86_400_000)),
          dealId: deal?.id ?? "",
          companyId,
          contactId: deal?.contactId ?? "",
          introduction: "",
          terms: org.invoiceTerms ?? "",
          notes: "",
          discountPercent: "0",
          taxLabel: org.defaultTaxLabel,
          taxRate: org.defaultTaxRate.toString(),
        }}
        initialItems={[{ key: "first", productId: null, title: "", description: "", quantity: "1", unit: "item", unitPrice: "", discountPercent: "0" }]}
        {...options}
        cancelHref={deal ? `/deals/${deal.id}` : "/invoices"}
      />
    </div>
  );
}
