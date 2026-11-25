import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOwnerOptions } from "@/lib/visibility";
import { getCompanyOptions } from "@/lib/queries/companies";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "../contact-form";
import { createContact } from "../actions";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  const user = await requirePermission("contact:create");
  const { companyId } = await searchParams;
  const [owners, companies] = await Promise.all([getOwnerOptions(user), getCompanyOptions(user)]);
  const preselected = companies.find((c) => c.id === companyId);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New contact"
        breadcrumbs={
          preselected
            ? [{ label: "Companies", href: "/companies" }, { label: preselected.name, href: `/companies/${preselected.id}` }, { label: "New contact" }]
            : [{ label: "Contacts", href: "/contacts" }, { label: "New" }]
        }
      />
      <ContactForm
        action={createContact}
        companies={companies}
        owners={owners}
        defaultOwnerId={user.id}
        defaultCompanyId={preselected?.id}
        cancelHref={preselected ? `/companies/${preselected.id}` : "/contacts"}
      />
    </div>
  );
}
