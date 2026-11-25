import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOwnerOptions } from "@/lib/visibility";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "../company-form";
import { createCompany } from "../actions";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage() {
  const user = await requirePermission("company:create");
  const owners = await getOwnerOptions(user);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New company" breadcrumbs={[{ label: "Companies", href: "/companies" }, { label: "New" }]} />
      <CompanyForm action={createCompany} owners={owners} defaultOwnerId={user.id} cancelHref="/companies" />
    </div>
  );
}
