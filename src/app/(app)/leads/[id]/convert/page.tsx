import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAssignableUsers } from "@/lib/queries/users";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getDefaultPipeline } from "@/lib/queries/pipeline";
import { PageHeader } from "@/components/ui/page-header";
import { ConvertLeadForm } from "./convert-form";
import { convertLead } from "../../actions";

export const metadata: Metadata = { title: "Convert lead" };

export default async function ConvertLeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("lead:convert");
  const { id } = await params;
  const [lead, owners, companies, pipeline] = await Promise.all([
    db.lead.findUnique({ where: { id } }),
    getAssignableUsers(),
    getCompanyOptions(),
    getDefaultPipeline(),
  ]);
  if (!lead) notFound();
  if (lead.status === "CONVERTED") redirect(`/leads/${lead.id}`);

  // If the business name matches a company we already have, suggest linking it.
  const suggested = lead.companyName
    ? companies.find((c) => c.name.trim().toLowerCase() === lead.companyName!.trim().toLowerCase())
    : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Convert lead to deal"
        description="The lead is marked as converted and a new deal starts in your pipeline."
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.title, href: `/leads/${lead.id}` }, { label: "Convert" }]}
      />
      <ConvertLeadForm
        action={convertLead.bind(null, lead.id)}
        lead={{
          id: lead.id,
          title: lead.title,
          contactName: lead.contactName,
          companyName: lead.companyName,
          companyId: lead.companyId,
          serviceType: lead.serviceType,
          estimatedValue: lead.estimatedValue?.toString() ?? null,
          currency: lead.currency,
          ownerId: lead.ownerId,
        }}
        companies={companies}
        owners={owners}
        stages={pipeline.openStages.map((s) => ({ id: s.id, name: s.name }))}
        suggestedCompanyId={suggested?.id ?? null}
      />
    </div>
  );
}
