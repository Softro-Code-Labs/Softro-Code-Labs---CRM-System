import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { TicketForm } from "../ticket-form";
import { getTicketFormOptions } from "../form-data";
import { saveTicket } from "../actions";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ companyId?: string; contractId?: string; contactId?: string }> }) {
  const user = await requirePermission("ticket:create");
  const sp = await searchParams;
  const options = await getTicketFormOptions();
  const contract = sp.contractId ? options.contracts.find((c) => c.id === sp.contractId) : undefined;
  const contact = sp.contactId ? await db.contact.findUnique({ where: { id: sp.contactId }, select: { id: true, companyId: true } }) : null;
  const companyId = contract?.companyId ?? contact?.companyId ?? options.companies.find((c) => c.id === sp.companyId)?.id ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New support ticket" breadcrumbs={[{ label: "Support", href: "/support" }, { label: "New" }]} />
      <TicketForm
        action={saveTicket.bind(null, null)}
        initial={{
          subject: "",
          description: "",
          priority: "MEDIUM",
          channel: "WHATSAPP",
          companyId,
          contactId: contact?.id ?? "",
          contractId: contract?.id ?? options.contracts.find((c) => c.companyId === companyId)?.id ?? "",
          assignedToId: user.id,
        }}
        {...options}
        cancelHref="/support"
      />
    </div>
  );
}
