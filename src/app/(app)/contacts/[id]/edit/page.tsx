import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { canSee, getOwnerOptions } from "@/lib/visibility";
import { getCompanyOptions } from "@/lib/queries/companies";
import { fullName } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "../../contact-form";
import { updateContact } from "../../actions";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contact:update");
  const { id } = await params;
  const [contact, companies] = await Promise.all([
    db.contact.findUnique({ where: { id } }),
    getCompanyOptions(user),
  ]);
  if (!contact || !(await canSee(user, "contact", id))) notFound();
  const owners = await getOwnerOptions(user, contact.ownerId);
  const name = fullName(contact);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${name}`}
        breadcrumbs={[{ label: "Contacts", href: "/contacts" }, { label: name, href: `/contacts/${contact.id}` }, { label: "Edit" }]}
      />
      <ContactForm
        action={updateContact.bind(null, contact.id)}
        contact={contact}
        companies={companies}
        owners={owners}
        defaultOwnerId={user.id}
        cancelHref={`/contacts/${contact.id}`}
      />
    </div>
  );
}
