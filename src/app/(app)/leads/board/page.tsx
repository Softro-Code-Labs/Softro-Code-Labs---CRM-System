import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import { SERVICE_TYPE_LABELS } from "@/lib/crm-meta";
import { BOARD_LEAD_WHERE } from "@/lib/visibility";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReplyBadge } from "@/components/crm/reply-badge";
import { TakeLeadButton } from "@/components/crm/take-lead-button";

export const metadata: Metadata = { title: "New web leads" };

/** Shared board of website enquiries nobody has taken yet. Everyone sees it; the first to take a lead owns it. */
export default async function LeadBoardPage() {
  const user = await requirePermission("lead:view");
  const leads = await db.lead.findMany({
    where: BOARD_LEAD_WHERE,
    orderBy: [{ respondBy: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      contactName: true,
      companyName: true,
      serviceType: true,
      description: true,
      estimatedValue: true,
      currency: true,
      respondBy: true,
      respondedAt: true,
      createdAt: true,
    },
  });
  const canTake = can(user.role, "lead:update");

  return (
    <>
      <PageHeader
        title="New web leads"
        description="Enquiries from the website that nobody has taken yet. Take one to start working on it; then only you, your manager and Admins see it."
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: "New web leads" }]}
      />
      {leads.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title="The board is clear" description="New enquiries from the website form will appear here." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <Card key={lead.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/leads/${lead.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                  {lead.title}
                </Link>
                <ReplyBadge respondBy={lead.respondBy} respondedAt={lead.respondedAt} compact />
              </div>
              <p className="mt-1 text-sm text-ink-600">{[lead.contactName, lead.companyName].filter(Boolean).join(" · ") || "Unknown contact"}</p>
              <p className="mt-1 text-xs text-ink-500">
                {[lead.serviceType && SERVICE_TYPE_LABELS[lead.serviceType], lead.estimatedValue && formatMoney(lead.estimatedValue, lead.currency), `Received ${formatDate(lead.createdAt)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {lead.description && <p className="mt-3 line-clamp-3 text-sm whitespace-pre-line text-ink-700">{lead.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <Link href={`/leads/${lead.id}`} className="text-sm text-ink-500 hover:text-brand-700">
                  View details
                </Link>
                {canTake && <TakeLeadButton id={lead.id} size="sm" />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
