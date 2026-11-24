import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOwnerOptions } from "@/lib/visibility";
import { getCompanyOptions } from "@/lib/queries/companies";
import { PageHeader } from "@/components/ui/page-header";
import { LeadForm } from "../lead-form";
import { createLead } from "../actions";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage() {
  const user = await requirePermission("lead:create");
  const [owners, companies] = await Promise.all([getOwnerOptions(user), getCompanyOptions()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New lead" description="Log a new enquiry. We aim to reply within 2 working days." breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: "New" }]} />
      <LeadForm
        action={createLead}
        companies={companies}
        owners={owners}
        defaultOwnerId={user.id}
        defaultCurrency={process.env.DEFAULT_CURRENCY ?? "LKR"}
        cancelHref="/leads"
      />
    </div>
  );
}
