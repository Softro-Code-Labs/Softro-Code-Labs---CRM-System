import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAssignableUsers } from "@/lib/queries/users";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getContactOptions } from "@/lib/queries/contacts";
import { getDefaultPipeline } from "@/lib/queries/pipeline";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../../deal-form";
import { updateDeal } from "../../actions";

export const metadata: Metadata = { title: "Edit deal" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("deal:update");
  const { id } = await params;
  const [deal, owners, companies, contacts, pipeline] = await Promise.all([
    db.deal.findUnique({ where: { id } }),
    getAssignableUsers(),
    getCompanyOptions(),
    getContactOptions(),
    getDefaultPipeline(),
  ]);
  if (!deal) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit deal" breadcrumbs={[{ label: "Deals", href: "/deals" }, { label: deal.title, href: `/deals/${deal.id}` }, { label: "Edit" }]} />
      <DealForm
        action={updateDeal.bind(null, deal.id)}
        isEdit
        isClosed={deal.status !== "OPEN"}
        initial={{
          title: deal.title,
          value: deal.value.toString(),
          currency: deal.currency,
          serviceType: deal.serviceType ?? "",
          stageId: deal.stageId,
          companyId: deal.companyId ?? "",
          contactId: deal.contactId ?? "",
          ownerId: deal.ownerId ?? "",
          expectedCloseDate: toDateInput(deal.expectedCloseDate),
          description: deal.description ?? "",
        }}
        companies={companies}
        contacts={contacts}
        owners={owners}
        stages={pipeline.openStages.map((s) => ({ id: s.id, name: s.name }))}
        cancelHref={`/deals/${deal.id}`}
      />
    </div>
  );
}
