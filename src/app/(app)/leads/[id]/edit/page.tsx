import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { canSee, getOwnerOptions } from "@/lib/visibility";
import { getCompanyOptions } from "@/lib/queries/companies";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "../../lead-form";
import { updateLead } from "../../actions";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("lead:update");
  const { id } = await params;
  const [lead, companies] = await Promise.all([db.lead.findUnique({ where: { id } }), getCompanyOptions()]);
  if (!lead || !(await canSee(user, "lead", id))) notFound();
  const owners = await getOwnerOptions(user, lead.ownerId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit lead`}
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.title, href: `/leads/${lead.id}` }, { label: "Edit" }]}
      />
      <LeadForm
        action={updateLead.bind(null, lead.id)}
        lead={{ ...lead, estimatedValue: lead.estimatedValue?.toString() ?? null }}
        companies={companies}
        owners={owners}
        defaultOwnerId={user.id}
        defaultCurrency={process.env.DEFAULT_CURRENCY ?? "LKR"}
        cancelHref={`/leads/${lead.id}`}
      />
    </div>
  );
}
