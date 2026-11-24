import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getContract } from "@/lib/contracts";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../../contract-form";
import { getContractFormOptions } from "../../form-data";
import { saveContract } from "../../actions";

export const metadata: Metadata = { title: "Edit contract" };

export default async function EditContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ renewed?: string }> }) {
  const user = await requirePermission("contract:manage");
  const { id } = await params;
  const { renewed } = await searchParams;
  const [c, options] = await Promise.all([getContract(id), getContractFormOptions(user)]);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={renewed ? `Renewed as ${c.number}` : `Edit ${c.number}`}
        description={renewed ? `Check the new dates and price, then save. ${c.renewedFrom?.number ?? "The old contract"} is now marked Ended.` : undefined}
        breadcrumbs={[{ label: "Contracts", href: "/contracts" }, { label: c.number, href: `/contracts/${c.id}` }, { label: "Edit" }]}
      />
      <ContractForm
        action={saveContract.bind(null, c.id)}
        isEdit
        initial={{
          title: c.title,
          type: c.type,
          companyId: c.companyId,
          contactId: c.contactId ?? "",
          dealId: c.dealId ?? "",
          ownerId: c.ownerId ?? "",
          startDate: toDateInput(c.startDate),
          endDate: toDateInput(c.endDate),
          billingCycle: c.billingCycle,
          amount: c.amount.toString(),
          currency: c.currency,
          autoRenew: c.autoRenew,
          renewalNoticeDays: String(c.renewalNoticeDays),
          responseTimeHours: c.responseTimeHours?.toString() ?? "",
          includedHours: c.includedHours?.toString() ?? "",
          scope: c.scope ?? "",
        }}
        {...options}
        cancelHref={`/contracts/${c.id}`}
      />
    </div>
  );
}
