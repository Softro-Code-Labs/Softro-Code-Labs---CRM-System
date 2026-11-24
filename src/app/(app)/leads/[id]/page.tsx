import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightCircle, Briefcase, Building2, Mail, Pencil, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/utils";
import {
  LANGUAGE_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  SERVICE_TYPE_LABELS,
} from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { ReplyBadge } from "@/components/crm/reply-badge";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { deleteLead } from "../actions";
import { LeadActions } from "./lead-actions";
import { RecordTimeline } from "@/components/crm/record-timeline";
import { TakeLeadButton } from "@/components/crm/take-lead-button";
import { canSee } from "@/lib/visibility";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { title: true } });
  return { title: lead?.title ?? "Lead" };
}

export default async function LeadPage({ params }: Props) {
  const user = await requirePermission("lead:view");
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      company: { select: { id: true, name: true } },
      convertedDeal: { select: { id: true, title: true } },
    },
  });
  if (!lead || !(await canSee(user, "lead", id))) notFound();
  // A website lead nobody has taken yet: everyone can see it, but must take it before working on it.
  const onBoard = !lead.ownerId && lead.source === "WEBSITE_FORM" && ["NEW", "CONTACTED", "QUALIFIED"].includes(lead.status);
  const mayWork = !onBoard || user.role === "ADMIN";

  const firstName = lead.contactName?.split(/\s+/)[0];
  const greeting =
    lead.language === "SINHALA"
      ? `ආයුබෝවන් ${firstName ?? ""}, Softro Code Labs වෙතින්.`
      : `Hi ${firstName ?? "there"}, this is Softro Code Labs about your enquiry: ${lead.title}.`;

  const details: [string, React.ReactNode][] = [
    ["Source", LEAD_SOURCE_LABELS[lead.source]],
    ["Service", lead.serviceType ? SERVICE_TYPE_LABELS[lead.serviceType] : null],
    ["Estimated value", lead.estimatedValue ? formatMoney(lead.estimatedValue, lead.currency) : null],
    ["Language", LANGUAGE_LABELS[lead.language]],
    ["Owner", lead.owner?.name],
    ["Received", formatDate(lead.createdAt)],
    ["Reply due", lead.respondBy ? lead.respondBy.toLocaleString("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" }) : null],
    ["Replied", lead.respondedAt ? formatDate(lead.respondedAt) : null],
  ];

  return (
    <>
      <PageHeader
        title={lead.title}
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: lead.title }]}
        actions={
          <>
            {can(user.role, "lead:delete") && <ConfirmDelete action={deleteLead.bind(null, lead.id)} title="Delete this lead?" body="Its notes and tasks go with it. This can't be undone." />}
            {onBoard && can(user.role, "lead:update") && <TakeLeadButton id={lead.id} />}
            {can(user.role, "lead:update") && mayWork && (
              <LinkButton href={`/leads/${lead.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
            {lead.status !== "CONVERTED" && lead.status !== "UNQUALIFIED" && can(user.role, "lead:convert") && (
              <LinkButton href={`/leads/${lead.id}/convert`}>
                <ArrowRightCircle className="size-4" aria-hidden /> Convert to deal
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
        {lead.status !== "CONVERTED" && lead.status !== "UNQUALIFIED" && <ReplyBadge respondBy={lead.respondBy} respondedAt={lead.respondedAt} />}
        {lead.status === "UNQUALIFIED" && lead.disqualifyReason && <span className="text-sm text-ink-500">Reason: {lead.disqualifyReason}</span>}
      </div>

      {lead.convertedDeal && (
        <Link
          href={`/deals/${lead.convertedDeal.id}`}
          className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 hover:bg-emerald-100"
        >
          <Briefcase className="size-4" aria-hidden />
          Converted to deal <strong>{lead.convertedDeal.title}</strong>
          {lead.convertedAt && <span className="text-emerald-600">on {formatDate(lead.convertedAt)}</span>}
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {onBoard && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              This website lead is on the <Link href="/leads/board" className="font-medium underline">New Leads board</Link>. Take it to start working on it;
              after that only you, your manager and Admins can see it.
            </div>
          )}
          {can(user.role, "lead:update") && mayWork && lead.status !== "CONVERTED" && (
            <Card>
              <CardHeader title="Next step" description="Reply, then qualify. Convert it to a deal once they want a proposal." />
              <CardBody>
                <LeadActions id={lead.id} status={lead.status} responded={Boolean(lead.respondedAt)} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Their idea / requirements" />
            <CardBody className="text-sm whitespace-pre-line text-ink-700">{lead.description || <span className="text-ink-400">No details yet.</span>}</CardBody>
          </Card>
          <RecordTimeline target={{ leadId: lead.id, dealId: null, companyId: null, contactId: null }} user={user} />
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="font-semibold text-ink-900">{lead.contactName ?? "Unknown contact"}</p>
            {(lead.company || lead.companyName) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
                <Building2 className="size-4 text-ink-400" aria-hidden />
                {lead.company ? (
                  <Link href={`/companies/${lead.company.id}`} className="hover:text-brand-700">
                    {lead.company.name}
                  </Link>
                ) : (
                  lead.companyName
                )}
              </p>
            )}
            <ul className="mt-4 space-y-2 text-sm">
              {lead.email && (
                <li>
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-700">
                    <Mail className="size-4 text-ink-400" aria-hidden /> {lead.email}
                  </a>
                </li>
              )}
              {[lead.whatsapp, lead.phone].filter(Boolean).map((num) => (
                <li key={num}>
                  <a href={`tel:${num}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-700">
                    <Phone className="size-4 text-ink-400" aria-hidden /> {num}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <WhatsAppButton phone={lead.whatsapp ?? lead.phone} message={greeting} size="sm" />
            </div>
          </Card>
          <Card>
            <dl className="divide-y divide-ink-100">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="text-right font-medium text-ink-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
