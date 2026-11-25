import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { avatarUrl } from "@/lib/avatar";
import { formatDate, formatMoneyTotals } from "@/lib/utils";
import { getTeamMembers, getWorkload } from "@/lib/team";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "My team" };

/** A Manager's team at a glance: who they are and what each person has open. Admins see every team. */
export default async function TeamPage() {
  const user = await requirePermission("team:view");
  const members = await getTeamMembers(user);
  const work = await getWorkload(members.map((m) => m.id));
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title={isAdmin ? "Teams" : "My team"}
        description={
          isAdmin
            ? "Everyone in Sales, Support and Viewer roles, with their manager and open work. Change someone's team under Settings → Team members."
            : "The people you manage and what each of them has open. An admin adds people to your team."
        }
      />
      <Card>
        {members.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={isAdmin ? "Nobody to show yet" : "No one in your team yet"}
            description={isAdmin ? "Add Sales staff under Settings → Team members." : "Ask an admin to choose you as the manager of your salespeople."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Person</th>
                  {isAdmin && <th className="px-5 py-3">Manager</th>}
                  <th className="px-5 py-3 text-right">Open leads</th>
                  <th className="px-5 py-3 text-right">Open deals</th>
                  <th className="px-5 py-3 text-right">Quotes out</th>
                  <th className="px-5 py-3 text-right">Overdue tasks</th>
                  <th className="px-5 py-3">Last sign-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.map((m) => {
                  const w = work.get(m.id)!;
                  return (
                    <tr key={m.id} className={m.isActive ? "hover:bg-ink-50" : "text-ink-400"}>
                      <td className="px-5 py-3">
                        <Link href={`/team/${m.id}`} className="flex items-center gap-3">
                          <Avatar name={m.name} src={avatarUrl(m)} />
                          <span>
                            <span className="block font-medium text-ink-900 hover:text-brand-700">{m.name}</span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                              {[m.jobTitle, ROLE_LABELS[m.role]].filter(Boolean).join(" · ")}
                              {!m.isActive && <Badge tone="gray">Deactivated</Badge>}
                            </span>
                          </span>
                        </Link>
                      </td>
                      {isAdmin && <td className="px-5 py-3 text-ink-600">{m.manager?.name ?? <span className="text-amber-700">No manager</span>}</td>}
                      <td className="px-5 py-3 text-right tabular-nums">{w.leads}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {w.deals}
                        {w.deals > 0 && <span className="block text-xs text-ink-500">{formatMoneyTotals(w.pipeline)}</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{w.quotes}</td>
                      <td className={w.overdue ? "px-5 py-3 text-right font-medium text-red-600 tabular-nums" : "px-5 py-3 text-right tabular-nums"}>{w.overdue}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-ink-500">{m.lastLoginAt ? formatDate(m.lastLoginAt) : "Never"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
