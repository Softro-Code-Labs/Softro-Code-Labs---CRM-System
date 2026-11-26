import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOrgSettings } from "@/lib/queries/org";
import { PageHeader } from "@/components/ui/page-header";
import { RatesForm } from "./rates-form";

export const metadata: Metadata = { title: "Commission & tax" };

/** Admins set the sales commission percentages and the income tax rates for the estimate. */
export default async function FinanceSettingsPage() {
  await requirePermission("org:manage");
  const org = await getOrgSettings();
  const s = (v: { toString(): string }) => String(Number(v.toString()));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Commission & tax"
        description="Commission is worked out when a payment is recorded, at the rates saved here. Changing a rate doesn't change commission already earned."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Commission & tax" }]}
      />
      <RatesForm
        initial={{
          commissionSalesPercent: s(org.commissionSalesPercent),
          commissionManagerPercent: s(org.commissionManagerPercent),
          commissionLeaderPercent: s(org.commissionLeaderPercent),
          incomeTaxPercent: s(org.incomeTaxPercent),
          exportIncomeTaxPercent: s(org.exportIncomeTaxPercent),
        }}
      />
    </div>
  );
}
