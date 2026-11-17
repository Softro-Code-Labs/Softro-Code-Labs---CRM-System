import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Building2, Handshake, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatMoney, fullName, humanize } from "@/lib/utils";
import { companyTypeTone } from "../companies/company-meta";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePermission("dashboard:view");
  const { denied } = await searchParams;
  const currency = process.env.DEFAULT_CURRENCY ?? "LKR";

  const [companyCount, customerCount, contactCount, openDeals, recentCompanies, recentContacts] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { type: "CUSTOMER" } }),
    db.contact.count(),
    db.deal.aggregate({ where: { status: "OPEN" }, _count: true, _sum: { value: true } }),
    db.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, industry: true, createdAt: true },
    }),
    db.contact.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, jobTitle: true, company: { select: { name: true } } },
    }),
  ]);

  const stats = [
    { label: "Companies", value: companyCount.toLocaleString(), icon: Building2, href: "/companies" },
    { label: "Customers", value: customerCount.toLocaleString(), icon: Handshake, href: "/companies?type=CUSTOMER" },
    { label: "Contacts", value: contactCount.toLocaleString(), icon: Users, href: "/contacts" },
    { label: "Open pipeline", value: formatMoney(openDeals._sum.value ?? 0, currency), icon: Briefcase, sub: `${openDeals._count} open deals` },
  ];

  return (
    <>
      {denied && (
        <div role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You don&apos;t have access to that page. Ask an admin if you need it.
        </div>
      )}
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Here's what's happening across Softro's clients today." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const body = (
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <Icon className="size-5 text-brand-500" aria-hidden />
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
              {stat.sub && <p className="mt-1 text-xs text-slate-500">{stat.sub}</p>}
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {body}
            </Link>
          ) : (
            <div key={stat.label}>{body}</div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recently added companies" action={<Link href="/companies" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
          {recentCompanies.length ? (
            <ul className="divide-y divide-slate-100">
              {recentCompanies.map((c) => (
                <li key={c.id}>
                  <Link href={`/companies/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.industry ?? "—"} · Added {formatDate(c.createdAt)}</p>
                    </div>
                    <Badge tone={companyTypeTone[c.type]}>{humanize(c.type)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-slate-500">No companies yet.</CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently added contacts" action={<Link href="/contacts" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>} />
          {recentContacts.length ? (
            <ul className="divide-y divide-slate-100">
              {recentContacts.map((c) => (
                <li key={c.id}>
                  <Link href={`/contacts/${c.id}`} className="block px-5 py-3 hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">{fullName(c)}</p>
                    <p className="text-xs text-slate-500">
                      {[c.jobTitle, c.company?.name].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody className="text-sm text-slate-500">No contacts yet.</CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
