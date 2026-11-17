import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOrgSettings } from "@/lib/queries/org";
import { PageHeader } from "@/components/ui/page-header";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Company details" };

export default async function CompanySettingsPage() {
  await requirePermission("org:manage");
  const org = await getOrgSettings();
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Company details"
        description="Softro's details and the defaults used on quotes."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Company details" }]}
      />
      <OrgForm
        initial={{
          companyName: org.companyName,
          address: s(org.address),
          phone: s(org.phone),
          email: s(org.email),
          website: s(org.website),
          registrationNo: s(org.registrationNo),
          vatNumber: s(org.vatNumber),
          defaultTaxLabel: org.defaultTaxLabel,
          defaultTaxRate: org.defaultTaxRate.toString(),
          defaultValidityDays: String(org.defaultValidityDays),
          defaultTerms: s(org.defaultTerms),
          bankDetails: s(org.bankDetails),
          quoteFooter: s(org.quoteFooter),
        }}
      />
    </div>
  );
}
