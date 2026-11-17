import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Link2, Mail, Pencil, Phone, Plus, Smartphone, Star } from "lucide-react";
import { DEAL_STATUS_TONE, LANGUAGE_LABELS } from "@/lib/crm-meta";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { deleteContact } from "../actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const contact = await db.contact.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return { title: contact ? fullName(contact) : "Contact" };
}

export default async function ContactPage({ params }: Props) {
  const user = await requirePermission("contact:view");
  const { id } = await params;
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      owner: { select: { name: true } },
      deals: {
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: { id: true, title: true, value: true, currency: true, status: true, stage: { select: { name: true } } },
      },
    },
  });
  if (!contact) notFound();
  const name = fullName(contact);

  const reach = [
    contact.email && { icon: Mail, label: contact.email, href: `mailto:${contact.email}` },
    contact.phone && { icon: Phone, label: contact.phone, href: `tel:${contact.phone}` },
    contact.mobile && { icon: Smartphone, label: contact.mobile, href: `tel:${contact.mobile}` },
    contact.linkedinUrl && { icon: Link2, label: "LinkedIn profile", href: contact.linkedinUrl, external: true },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href: string; external?: boolean }[];

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[{ label: "Contacts", href: "/contacts" }, { label: name }]}
        actions={
          <>
            {can(user.role, "contact:delete") && <ConfirmDelete action={deleteContact.bind(null, contact.id)} />}
            {can(user.role, "contact:update") && (
              <LinkButton href={`/contacts/${contact.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar name={name} className="size-14 text-base" />
              <div>
                <p className="font-semibold text-ink-900">{name}</p>
                <p className="text-sm text-ink-500">{[contact.jobTitle, contact.department].filter(Boolean).join(" · ") || "—"}</p>
                {contact.isPrimary && (
                  <Badge tone="amber" className="mt-2 gap-1">
                    <Star className="size-3 fill-current" aria-hidden /> Primary contact
                  </Badge>
                )}
              </div>
            </div>
            {contact.company && (
              <Link href={`/companies/${contact.company.id}`} className="mt-5 flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700">
                <Building2 className="size-4" aria-hidden /> {contact.company.name}
              </Link>
            )}
            {reach.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-ink-100 pt-4">
                {reach.map(({ icon: Icon, label, href, external }) => (
                  <li key={href}>
                    <a
                      href={href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700"
                    >
                      <Icon className="size-4 text-ink-400" aria-hidden /> {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <WhatsAppButton phone={contact.mobile ?? contact.phone} size="sm" />
            </div>
          </Card>
          <Card>
            <dl className="divide-y divide-ink-100">
              {[
                ["Owner", contact.owner?.name],
                ["Language", LANGUAGE_LABELS[contact.language]],
                ["Created", formatDate(contact.createdAt)],
                ["Last updated", formatDate(contact.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="font-medium text-ink-900">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={`Deals (${contact.deals.length})`}
              action={
                can(user.role, "deal:create") && (
                  <LinkButton href={`/deals/new?contactId=${contact.id}`} size="sm" variant="secondary">
                    <Plus className="size-4" aria-hidden /> New deal
                  </LinkButton>
                )
              }
            />
            {contact.deals.length ? (
              <ul className="divide-y divide-ink-100">
                {contact.deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/deals/${d.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{d.title}</p>
                        <p className="text-xs text-ink-500">{d.stage.name}</p>
                      </div>
                      <Badge tone={DEAL_STATUS_TONE[d.status]}>{formatMoney(d.value, d.currency)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="text-sm text-ink-500">No deals with {contact.firstName} yet.</CardBody>
            )}
          </Card>
          <Card className="mt-6">
            <CardHeader title="Activity timeline" description="Calls, emails, meetings and notes arrive in Step 3." />
            <CardBody className="text-sm text-ink-500">Nothing logged yet for {contact.firstName}.</CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
