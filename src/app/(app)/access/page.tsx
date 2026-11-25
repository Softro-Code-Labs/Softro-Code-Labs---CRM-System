import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { cn, firstParam, formatDate } from "@/lib/utils";
import { checkState } from "@/lib/project-access";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";

export const metadata: Metadata = { title: "Project access" };

const TABS = [
  { value: "active", label: "Active" },
  { value: "check", label: "Needs a check" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function AccessListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("access:view");
  const v = await getVisibility(user);
  const sp = await searchParams;
  const tabParam = firstParam(sp.tab);
  const tab: Tab = (TABS.map((t) => t.value) as string[]).includes(tabParam) ? (tabParam as Tab) : "active";
  const q = firstParam(sp.q);

  const where: Prisma.ProjectAccessWhereInput = {
    AND: [v.access],
    ...(tab === "active" && { status: "ACTIVE" }),
    ...(tab === "archived" && { status: "ARCHIVED" }),
    ...(q && {
      OR: [
        { deal: { title: { contains: q, mode: "insensitive" } } },
        { deal: { company: { name: { contains: q, mode: "insensitive" } } } },
        { googleEmail: { contains: q, mode: "insensitive" } },
        { services: { some: { name: { contains: q, mode: "insensitive" } } } },
      ],
    }),
  };
  const rows = await db.projectAccess.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 300,
    include: {
      deal: { select: { id: true, title: true, company: { select: { name: true } } } },
      services: { select: { name: true, renewsAt: true }, orderBy: { renewsAt: { sort: "asc", nulls: "last" } } },
    },
  });
  const now = new Date();
  const withState = rows.map((r) => ({ ...r, check: checkState(r, now), nextRenewal: r.services.find((s) => s.renewsAt && s.renewsAt >= now) ?? null }));
  const list = tab === "check" ? withState.filter((r) => r.check.state === "overdue" || r.check.state === "never" || r.check.state === "due-soon") : withState;

  return (
    <>
      <PageHeader title="Project access" description="Each project's Google account, the services made with it, and when to check or renew them. No passwords are kept here." />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 pt-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={t.value === "active" ? `/access${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/access?tab=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn("-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium", tab === t.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800")}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="mb-2">
            <SearchInput placeholder="Project, client, Gmail or service…" />
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={tab === "check" ? "Every project Gmail has been checked recently" : "No projects here"}
            description="Open a won deal and choose Project access to record its Google account and services."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Project</th>
                  <th className="px-5 py-3">Project Gmail</th>
                  <th className="px-5 py-3">Services</th>
                  <th className="px-5 py-3">Last checked</th>
                  <th className="px-5 py-3">Next renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-5 py-3">
                      <Link href={`/deals/${r.deal.id}/access`} className="font-medium text-ink-900 hover:text-brand-700">
                        {r.deal.title}
                      </Link>
                      <span className="block text-xs text-ink-500">
                        {r.deal.company?.name ?? "No company"}
                        {r.status === "ARCHIVED" && " · archived"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{r.googleEmail ?? <span className="text-ink-400">Not set</span>}</td>
                    <td className="px-5 py-3 text-ink-600">
                      <span className="line-clamp-2 max-w-64">{r.services.map((s) => s.name).join(", ") || "—"}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {r.check.state === "no-account" ? (
                        <span className="text-ink-400">—</span>
                      ) : r.check.state === "never" ? (
                        <Badge tone="red">Never</Badge>
                      ) : r.check.state === "overdue" ? (
                        <Badge tone="red">Overdue · {formatDate(r.lastCheckedAt)}</Badge>
                      ) : (
                        <Badge tone={r.check.state === "due-soon" ? "amber" : "green"}>{formatDate(r.lastCheckedAt)}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-600">{r.nextRenewal ? `${r.nextRenewal.name} · ${formatDate(r.nextRenewal.renewsAt)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
