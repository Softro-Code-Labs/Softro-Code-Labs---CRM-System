import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { APP_TIME_ZONE, firstParam, parsePage } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterSelect } from "@/components/ui/filter-select";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const ACTION_TONE: Record<string, BadgeTone> = { create: "green", update: "blue", delete: "red", login: "gray", logout: "gray", export: "amber" };
const ENTITIES = ["Company", "Contact", "Lead", "Deal", "Activity", "Note", "Quote", "Invoice", "Product", "Contract", "Ticket", "Report", "User", "PipelineStage", "OrgSettings"];

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("audit:view");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const entity = ENTITIES.includes(firstParam(sp.entity)) ? firstParam(sp.entity) : undefined;
  const actorId = firstParam(sp.user) || undefined;

  const where: Prisma.AuditLogWhereInput = { ...(entity && { entity }), ...(actorId && { actorId }) };
  const [total, logs, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true } } },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in and every change, newest first. Read-only."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Audit log" }]}
      />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 px-5 py-3">
          <FilterSelect param="entity" label="Everything" options={ENTITIES.map((e) => ({ value: e, label: e === "PipelineStage" ? "Pipeline stage" : e }))} />
          <FilterSelect param="user" label="All people" options={users.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Who</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">What</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-ink-500">
                    {log.createdAt.toLocaleString("en-GB", { timeZone: APP_TIME_ZONE, dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-ink-800">{log.actor?.name ?? (log.actorId ? "Removed user" : "Website / system")}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={ACTION_TONE[log.action] ?? "gray"}>{log.action}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-ink-700">
                    <span className="text-ink-500">{log.entity === "PipelineStage" ? "Pipeline stage" : log.entity}</span>
                    {log.summary && <span>: {log.summary}</span>}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-ink-500">
                    Nothing logged for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/settings/audit" params={{ entity, user: actorId }} />
      </Card>
    </>
  );
}
