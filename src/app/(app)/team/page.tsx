import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { avatarUrl } from "@/lib/avatar";
import { formatDate, formatMoneyTotals } from "@/lib/utils";
import { getTeamLeads, getTeamMembers, getWorkload, type Workload } from "@/lib/team";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user?.role === "ADMIN" ? "Teams" : "My team" };
}

type Member = Awaited<ReturnType<typeof getTeamMembers>>[number];
type Lead = Awaited<ReturnType<typeof getTeamLeads>>[number];

function totals(members: Member[], work: Map<string, Workload>) {
  const t = { leads: 0, deals: 0, quotes: 0, overdue: 0 };
  for (const m of members) {
    const w = work.get(m.id)!;
    t.leads += w.leads;
    t.deals += w.deals;
    t.quotes += w.quotes;
    t.overdue += w.overdue;
  }
  return t;
}

/** One team: its manager as the heading (or "No manager yet"), then a row per member with their open work. */
function TeamCard({ lead, members, work, isAdmin }: { lead: Lead | null; members: Member[]; work: Map<string, Workload>; isAdmin: boolean }) {
  const t = totals(members, work);
  const count = `${members.length} ${members.length === 1 ? "member" : "members"}`;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        {lead ? (
          <div className="flex items-center gap-3">
            <Avatar name={lead.name} src={avatarUrl(lead)} />
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
                {lead.name}&apos;s team
                {!lead.isActive && <Badge tone="gray">Deactivated</Badge>}
              </p>
              <p className="text-xs text-ink-500">{[lead.jobTitle, ROLE_LABELS[lead.role], count].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-amber-700">No manager yet</p>
            <p className="text-xs text-ink-500">
              {count}. Only admins see their work until a manager is chosen.{" "}
              {isAdmin && (
                <Link href="/settings/users" className="font-medium text-brand-700 hover:underline">
                  Set a manager
                </Link>
              )}
            </p>
          </div>
        )}
        {members.length > 0 && (
          <p className="text-xs text-ink-500 tabular-nums">
            Team: {t.leads} open leads · {t.deals} open deals · {t.quotes} quotes out
            {t.overdue > 0 && <span className="font-medium text-red-600"> · {t.overdue} overdue</span>}
          </p>
        )}
      </div>
      {members.length === 0 ? (
        <p className="px-5 py-5 text-sm text-ink-500">
          No members yet.{" "}
          {isAdmin ? (
            <>
              Choose this manager for people under{" "}
              <Link href="/settings/users" className="font-medium text-brand-700 hover:underline">
                Settings → Team members
              </Link>
              .
            </>
          ) : (
            "Ask an admin to choose you as the manager of your salespeople."
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-3">Person</th>
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
  );
}

/**
 * Teams at a glance, one card per manager with their members' open work.
 * A Manager sees their own team; an Admin sees every team, plus anyone who has no manager yet.
 */
export default async function TeamPage() {
  const user = await requirePermission("team:view");
  const isAdmin = user.role === "ADMIN";
  const [members, leads] = await Promise.all([getTeamMembers(user), getTeamLeads(user)]);
  const work = await getWorkload(members.map((m) => m.id));
  const leadIds = new Set(leads.map((l) => l.id));
  const teams = leads.map((lead) => ({ lead, members: members.filter((m) => m.managerId === lead.id) }));
  const unassigned = isAdmin ? members.filter((m) => !m.managerId || !leadIds.has(m.managerId)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? "Teams" : "My team"}
        description={
          isAdmin
            ? "Each manager with the Sales, Support and Viewer people in their team, and their open work. Admins and managers lead teams rather than belong to one. Change someone's team under Settings → Team members."
            : "The people you manage and what each of them has open. An admin adds people to your team."
        }
      />
      {teams.length === 0 && unassigned.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title="No teams yet" description="Add a Manager and Sales staff under Settings → Team members, then choose each person's manager." />
        </Card>
      ) : (
        <>
          {teams.map((t) => (
            <TeamCard key={t.lead.id} lead={t.lead} members={t.members} work={work} isAdmin={isAdmin} />
          ))}
          {unassigned.length > 0 && <TeamCard lead={null} members={unassigned} work={work} isAdmin={isAdmin} />}
        </>
      )}
    </div>
  );
}
