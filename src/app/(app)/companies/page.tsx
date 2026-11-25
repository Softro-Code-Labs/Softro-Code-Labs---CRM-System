import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { CompanyType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { firstParam, formatDate, humanize, parsePage } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { COMPANY_TYPE_OPTIONS, companyTypeTone } from "./company-meta";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Companies" };

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("company:view");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const typeParam = firstParam(sp.type);
  const type = (Object.values(CompanyType) as string[]).includes(typeParam) ? (typeParam as CompanyType) : undefined;
  const page = parsePage(sp.page);

  const v = await getVisibility(user);
  const where: Prisma.CompanyWhereInput = {
    AND: [v.company],
    ...(type && { type }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [total, companies] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        type: true,
        industry: true,
        city: true,
        country: true,
        createdAt: true,
        owner: { select: { name: true } },
        _count: { select: { contacts: true } },
      },
    }),
  ]);

  const filterHref = (t?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (t) params.set("type", t);
    const qs = params.toString();
    return qs ? `/companies?${qs}` : "/companies";
  };

  return (
    <>
      <PageHeader
        title="Companies"
        description="Clients, prospects, partners and vendors."
        actions={
          can(user.role, "company:create") && (
            <LinkButton href="/companies/new">
              <Plus className="size-4" aria-hidden /> New company
            </LinkButton>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
          <div className="flex flex-wrap gap-1">
            {[{ value: "", label: "All" }, ...COMPANY_TYPE_OPTIONS].map((opt) => (
              <Link
                key={opt.value || "all"}
                href={filterHref(opt.value || undefined)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  (type ?? "") === opt.value ? "bg-ink-900 text-ink-50" : "text-ink-600 hover:bg-ink-100",
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>
          <SearchInput placeholder="Search companies…" />
        </div>

        {companies.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={q || type ? "No companies match your filters" : "No companies yet"}
            description={q || type ? "Try a different search or filter." : "Add your first client or prospect to get started."}
            action={
              !q && !type && can(user.role, "company:create") ? (
                <LinkButton href="/companies/new">
                  <Plus className="size-4" aria-hidden /> New company
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3 text-right">Contacts</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link href={`/companies/${c.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                      <p className="text-xs text-ink-500">{c.industry ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={companyTypeTone[c.type]}>{humanize(c.type)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-5 py-3 text-right text-ink-600 tabular-nums">{c._count.contacts}</td>
                    <td className="px-5 py-3 text-ink-600">{c.owner?.name ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/companies" params={{ q: q || undefined, type }} />
      </Card>
    </>
  );
}
