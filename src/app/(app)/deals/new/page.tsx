import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOwnerOptions } from "@/lib/visibility";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getContactOptions } from "@/lib/queries/contacts";
import { getDefaultPipeline } from "@/lib/queries/pipeline";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../deal-form";
import { createDeal } from "../actions";

export const metadata: Metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ companyId?: string; contactId?: string; stageId?: string }> }) {
  const user = await requirePermission("deal:create");
  const sp = await searchParams;
  const [owners, companies, contacts, pipeline] = await Promise.all([
    getOwnerOptions(user),
    getCompanyOptions(user),
    getContactOptions(user),
    getDefaultPipeline(),
  ]);
  const contact = contacts.find((c) => c.id === sp.contactId);
  const companyId = companies.find((c) => c.id === sp.companyId)?.id ?? contact?.companyId ?? "";
  const stageId = pipeline.openStages.find((s) => s.id === sp.stageId)?.id ?? pipeline.openStages[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New deal" breadcrumbs={[{ label: "Deals", href: "/deals" }, { label: "New" }]} />
      <DealForm
        action={createDeal}
        initial={{
          title: "",
          value: "",
          currency: process.env.DEFAULT_CURRENCY ?? "LKR",
          serviceType: "",
          stageId,
          companyId,
          contactId: contact?.id ?? "",
          ownerId: user.id,
          expectedCloseDate: "",
          description: "",
        }}
        companies={companies}
        contacts={contacts}
        owners={owners}
        stages={pipeline.openStages.map((s) => ({ id: s.id, name: s.name }))}
        cancelHref={companyId ? `/companies/${companyId}` : "/deals"}
      />
    </div>
  );
}
