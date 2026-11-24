import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { toDateInput } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ContractForm } from "../contract-form";
import { getContractFormOptions } from "../form-data";
import { saveContract } from "../actions";

export const metadata: Metadata = { title: "New contract" };

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ companyId?: string; dealId?: string }> }) {
  const user = await requirePermission("contract:manage");
  const sp = await searchParams;
  const [options, deal] = await Promise.all([
    getContractFormOptions(user),
    sp.dealId ? db.deal.findUnique({ where: { id: sp.dealId }, select: { id: true, title: true, companyId: true, contactId: true, currency: true } }) : null,
  ]);
  const companyId = deal?.companyId ?? options.companies.find((c) => c.id === sp.companyId)?.id ?? "";
  const start = new Date();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New contract"
        description="Maintenance, hosting, retainers and subscriptions: anything a client pays for on an ongoing basis."
        breadcrumbs={[{ label: "Contracts", href: "/contracts" }, { label: "New" }]}
      />
      <ContractForm
        action={saveContract.bind(null, null)}
        initial={{
          title: deal ? `${deal.title}: maintenance & support` : "",
          type: "MAINTENANCE",
          companyId,
          contactId: deal?.contactId ?? "",
          dealId: deal?.id ?? "",
          ownerId: user.id,
          startDate: toDateInput(start),
          endDate: toDateInput(end),
          billingCycle: "MONTHLY",
          amount: "",
          currency: deal?.currency ?? process.env.DEFAULT_CURRENCY ?? "LKR",
          autoRenew: true,
          renewalNoticeDays: "30",
          responseTimeHours: "",
          includedHours: "",
          scope: "",
        }}
        {...options}
        cancelHref={deal ? `/deals/${deal.id}` : companyId ? `/companies/${companyId}` : "/contracts"}
      />
    </div>
  );
}
