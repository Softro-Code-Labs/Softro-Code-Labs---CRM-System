import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getOrgSettings } from "@/lib/queries/org";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteEditor } from "../quote-editor";
import { getEditorOptions } from "../editor-data";
import { saveQuote } from "../actions";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ dealId?: string; companyId?: string }> }) {
  await requirePermission("quote:create");
  const sp = await searchParams;
  const [org, options, deal] = await Promise.all([
    getOrgSettings(),
    getEditorOptions(),
    sp.dealId ? db.deal.findUnique({ where: { id: sp.dealId }, select: { id: true, title: true, currency: true, companyId: true, contactId: true, description: true } }) : null,
  ]);
  const now = new Date();
  const companyId = deal?.companyId ?? options.companies.find((c) => c.id === sp.companyId)?.id ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="New quote"
        description="Gets the next quote number when you save. It starts as a draft, so nothing goes to the client yet."
        breadcrumbs={deal ? [{ label: "Deals", href: "/deals" }, { label: deal.title, href: `/deals/${deal.id}` }, { label: "New quote" }] : [{ label: "Quotes", href: "/quotes" }, { label: "New" }]}
      />
      <QuoteEditor
        action={saveQuote.bind(null, null)}
        initial={{
          title: deal?.title ?? "",
          currency: deal?.currency ?? process.env.DEFAULT_CURRENCY ?? "LKR",
          issueDate: toDateInput(now),
          validUntil: toDateInput(new Date(now.getTime() + org.defaultValidityDays * 86_400_000)),
          dealId: deal?.id ?? "",
          companyId,
          contactId: deal?.contactId ?? "",
          introduction: "",
          terms: org.defaultTerms ?? "",
          notes: "",
          discountPercent: "0",
          taxLabel: org.defaultTaxLabel,
          taxRate: org.defaultTaxRate.toString(),
        }}
        initialItems={[{ key: "first", productId: null, title: "", description: deal?.description ?? "", quantity: "1", unit: "project", unitPrice: "", discountPercent: "0" }]}
        {...options}
        cancelHref={deal ? `/deals/${deal.id}` : "/quotes"}
      />
    </div>
  );
}
