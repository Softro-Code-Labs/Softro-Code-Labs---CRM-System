import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { canSee, getOwnerOptions } from "@/lib/visibility";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "../../company-form";
import { updateCompany } from "../../actions";

export const metadata: Metadata = { title: "Edit company" };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("company:update");
  const { id } = await params;
  const company = await db.company.findUnique({ where: { id } });
  if (!company || !(await canSee(user, "company", id))) notFound();
  const owners = await getOwnerOptions(user, company.ownerId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${company.name}`}
        breadcrumbs={[
          { label: "Companies", href: "/companies" },
          { label: company.name, href: `/companies/${company.id}` },
          { label: "Edit" },
        ]}
      />
      <CompanyForm
        action={updateCompany.bind(null, company.id)}
        company={company}
        owners={owners}
        defaultOwnerId={user.id}
        cancelHref={`/companies/${company.id}`}
      />
    </div>
  );
}
