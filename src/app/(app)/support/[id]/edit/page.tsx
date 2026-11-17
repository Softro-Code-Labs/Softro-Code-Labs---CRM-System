import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { TicketForm } from "../../ticket-form";
import { getTicketFormOptions } from "../../form-data";
import { saveTicket } from "../../actions";

export const metadata: Metadata = { title: "Edit ticket" };

export default async function EditTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ticket:update");
  const { id } = await params;
  const [t, options] = await Promise.all([db.ticket.findUnique({ where: { id } }), getTicketFormOptions()]);
  if (!t) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${t.number}`} breadcrumbs={[{ label: "Support", href: "/support" }, { label: t.number, href: `/support/${t.id}` }, { label: "Edit" }]} />
      <TicketForm
        action={saveTicket.bind(null, t.id)}
        isEdit
        initial={{
          subject: t.subject,
          description: t.description ?? "",
          priority: t.priority,
          channel: t.channel,
          companyId: t.companyId ?? "",
          contactId: t.contactId ?? "",
          contractId: t.contractId ?? "",
          assignedToId: t.assignedToId ?? "",
        }}
        {...options}
        cancelHref={`/support/${t.id}`}
      />
    </div>
  );
}
