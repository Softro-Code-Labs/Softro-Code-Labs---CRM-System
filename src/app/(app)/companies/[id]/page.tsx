import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Mail, MapPin, Pencil, Phone, Plus, Star, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, formatMoney, formatMoneyTotals, fullName, humanize } from "@/lib/utils";
import { DEAL_STATUS_TONE, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { companyTypeTone } from "../company-meta";
import { deleteCompany } from "../actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const company = await db.company.findUnique({ where: { id }, select: { name: true } });
  return { title: company?.name ?? "Company" };
}

export default async function CompanyPage({ params }: Props) {
  const user = await requirePermission("company:view");
  const { id } = await params;

  const company = await db.company.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      deals: {
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: { id: true, title: true, value: true, currency: true, status: true, stage: { select: { name: true } } },
      },
      leads: {
        where: { status: { not: "CONVERTED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, createdAt: true },
      },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true, isPrimary: true },
      },
    },
  });
  if (!company) notFound();

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Industry", value: company.industry },
    { label: "Company size", value: company.employeeSize && `${company.employeeSize} employees` },
    { label: "Tax / BR number", value: company.taxId },
    { label: "Account owner", value: company.owner?.name },
    { label: "Created", value: formatDate(company.createdAt) },
    { label: "Last updated", value: formatDate(company.updatedAt) },
  ];

  return (
    <>
      <PageHeader
        title={company.name}
        breadcrumbs={[{ label: "Companies", href: "/companies" }, { label: company.name }]}
        actions={
          <>
            {can(user.role, "company:delete") && <ConfirmDelete action={deleteCompany.bind(null, company.id)} />}
            {can(user.role, "company:update") && (
              <LinkButton href={`/companies/${company.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
        <Badge tone={companyTypeTone[company.type]}>{humanize(company.type)}</Badge>
        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-brand-700">
            <Globe className="size-4" aria-hidden /> {company.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        {company.email && (
          <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 hover:text-brand-700">
            <Mail className="size-4" aria-hidden /> {company.email}
          </a>
        )}
        {company.phone && (
          <a href={`tel:${company.phone}`} className="flex items-center gap-1.5 hover:text-brand-700">
            <Phone className="size-4" aria-hidden /> {company.phone}
          </a>
        )}
        {(company.addressLine || company.city || company.country) && (
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {[company.addressLine, company.city, company.country].filter(Boolean).join(", ")}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={`Contacts (${company.contacts.length})`}
              action={
                can(user.role, "contact:create") && (
                  <LinkButton href={`/contacts/new?companyId=${company.id}`} size="sm" variant="secondary">
                    <Plus className="size-4" aria-hidden /> Add contact
                  </LinkButton>
                )
              }
            />
            {company.contacts.length ? (
              <ul className="divide-y divide-slate-100">
                {company.contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/contacts/${c.id}`} className="flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:text-brand-700">
                        {fullName(c)}
                        {c.isPrimary && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Primary contact" />}
                      </Link>
                      <p className="text-xs text-slate-500">{c.jobTitle ?? "—"}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {c.email && <p>{c.email}</p>}
                      {c.phone && <p>{c.phone}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="flex items-center gap-2 text-sm text-slate-500">
                <Users className="size-4" aria-hidden /> No contacts at this company yet.
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`Deals (${company.deals.length})`}
              description={company.deals.length ? `Won so far: ${formatMoneyTotals(company.deals.filter((d) => d.status === "WON"))}` : undefined}
              action={
                can(user.role, "deal:create") && (
                  <LinkButton href={`/deals/new?companyId=${company.id}`} size="sm" variant="secondary">
                    <Plus className="size-4" aria-hidden /> New deal
                  </LinkButton>
                )
              }
            />
            {company.deals.length ? (
              <ul className="divide-y divide-slate-100">
                {company.deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/deals/${d.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{d.title}</p>
                        <p className="text-xs text-slate-500">{d.stage.name}</p>
                      </div>
                      <Badge tone={DEAL_STATUS_TONE[d.status]}>{formatMoney(d.value, d.currency)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="text-sm text-slate-500">No deals with {company.name} yet.</CardBody>
            )}
          </Card>

          {company.leads.length > 0 && (
            <Card>
              <CardHeader title={`Open leads (${company.leads.length})`} />
              <ul className="divide-y divide-slate-100">
                {company.leads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                      <span className="truncate text-sm font-medium text-slate-900">{l.title}</span>
                      <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-slate-100">
              {details.map((d) => (
                <div key={d.label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                  <dt className="text-slate-500">{d.label}</dt>
                  <dd className="text-right font-medium text-slate-900">{d.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {company.description && (
            <Card>
              <CardHeader title="About" />
              <CardBody className="text-sm whitespace-pre-line text-slate-700">{company.description}</CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
