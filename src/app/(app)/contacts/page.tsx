import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Star, Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { firstParam, formatDate, fullName, parsePage } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";

export const metadata: Metadata = { title: "Contacts" };

const PAGE_SIZE = 20;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("contact:view");
  const sp = await searchParams;
  const q = firstParam(sp.q);
  const page = parsePage(sp.page);

  // Split "Nimal Perera" into words so first + last name searches work.
  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const v = await getVisibility(user);
  const search: Prisma.ContactWhereInput = words.length
    ? {
        AND: words.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
            { email: { contains: word, mode: "insensitive" } },
            { jobTitle: { contains: word, mode: "insensitive" } },
            { phone: { contains: word } },
            { mobile: { contains: word } },
            { company: { name: { contains: word, mode: "insensitive" } } },
          ],
        })),
      }
    : {};
  const where: Prisma.ContactWhereInput = { AND: [v.contact, search] };

  const [total, contacts] = await Promise.all([
    db.contact.count({ where }),
    db.contact.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        email: true,
        phone: true,
        mobile: true,
        isPrimary: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="People at our client and prospect companies."
        actions={
          can(user.role, "contact:create") && (
            <LinkButton href="/contacts/new">
              <Plus className="size-4" aria-hidden /> New contact
            </LinkButton>
          )
        }
      />

      <Card>
        <div className="flex justify-end border-b border-ink-100 px-5 py-3">
          <SearchInput placeholder="Search name, email, company…" />
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No contacts match your search" : "No contacts yet"}
            description={q ? "Try a different name, email or company." : "Add the people you work with at your client companies."}
            action={
              !q && can(user.role, "contact:create") ? (
                <LinkButton href="/contacts/new">
                  <Plus className="size-4" aria-hidden /> New contact
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link href={`/contacts/${c.id}`} className="flex items-center gap-1.5 font-medium text-ink-900 hover:text-brand-700">
                        {fullName(c)}
                        {c.isPrimary && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Primary contact" />}
                      </Link>
                      <p className="text-xs text-ink-500">{c.jobTitle ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      {c.company ? (
                        <Link href={`/companies/${c.company.id}`} className="text-ink-700 hover:text-brand-700">
                          {c.company.name}
                        </Link>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="hover:text-brand-700">
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-600">{c.mobile ?? c.phone ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/contacts" params={{ q: q || undefined }} />
      </Card>
    </>
  );
}
