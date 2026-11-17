import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarClock } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { ActivityType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { activitySelect } from "@/lib/activities";
import { colomboDayBounds } from "@/lib/working-days";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_OPTIONS, PRIORITY_LABELS } from "@/lib/crm-meta";
import { cn, firstParam } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { DeleteEntryButton, DoneCheckbox } from "@/components/crm/activity-controls";
import { ACTIVITY_ICONS, ActivityContext, canManageActivity, formatWhen } from "@/components/crm/record-timeline";

export const metadata: Metadata = { title: "Activities" };

const TABS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("activity:view");
  const sp = await searchParams;
  const tabParam = firstParam(sp.tab);
  const tab: Tab = (TABS.map((t) => t.value) as string[]).includes(tabParam) ? (tabParam as Tab) : "today";
  const who = firstParam(sp.who) === "all" ? "all" : "me";
  const typeParam = firstParam(sp.type);
  const type = (Object.values(ActivityType) as string[]).includes(typeParam) ? (typeParam as ActivityType) : undefined;

  const now = new Date();
  const { start, end } = colomboDayBounds(now);
  const base: Prisma.ActivityWhereInput = {
    ...(who === "me" && { assignedToId: user.id }),
    ...(type && { type }),
  };
  const open: Prisma.ActivityWhereInput = { ...base, completedAt: null };
  const filters: Record<Tab, Prisma.ActivityWhereInput> = {
    overdue: { ...open, dueAt: { lt: now } },
    // Today: still to do today, plus open items with no due date.
    today: { ...open, OR: [{ dueAt: { gte: now, lt: end } }, { dueAt: null }] },
    upcoming: { ...open, dueAt: { gte: end } },
    done: { ...base, completedAt: { gte: new Date(start.getTime() - 30 * 86_400_000) } },
  };

  const [items, counts] = await Promise.all([
    db.activity.findMany({
      where: filters[tab],
      select: activitySelect,
      orderBy: tab === "done" ? { completedAt: "desc" } : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 200,
    }),
    Promise.all((["overdue", "today", "upcoming"] as const).map((t) => db.activity.count({ where: filters[t] }))),
  ]);
  const countFor: Partial<Record<Tab, number>> = { overdue: counts[0], today: counts[1], upcoming: counts[2] };

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { tab, who, type, ...patch };
    if (merged.tab !== "today") params.set("tab", merged.tab!);
    if (merged.who !== "me") params.set("who", merged.who!);
    if (merged.type) params.set("type", merged.type);
    const qs = params.toString();
    return qs ? `/activities?${qs}` : "/activities";
  };
  const pill = (active: boolean) => cn("rounded-md px-2.5 py-1 text-xs font-medium", active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800");

  return (
    <>
      <PageHeader title="Activities" description="Your calls, WhatsApp follow-ups, meetings and tasks. Add new ones from any lead, deal, company or contact." />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 pt-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={href({ tab: t.value })}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium",
                  tab === t.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800",
                )}
              >
                {t.label}
                {countFor[t.value] ? (
                  <span className={cn("rounded-full px-1.5 text-xs font-semibold", t.value === "overdue" ? "bg-red-100 text-red-700" : "bg-ink-100 text-ink-600")}>
                    {countFor[t.value]}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-ink-200 bg-ink-100 p-1">
              <Link href={href({ who: "me" })} className={pill(who === "me")}>Mine</Link>
              <Link href={href({ who: "all" })} className={pill(who === "all")}>Everyone</Link>
            </div>
            <FilterSelect param="type" label="All types" options={ACTIVITY_TYPE_OPTIONS} />
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={tab === "overdue" ? "Nothing overdue" : tab === "today" ? "Nothing left for today" : tab === "upcoming" ? "Nothing scheduled yet" : "Nothing completed in the last 30 days"}
            description="Schedule follow-ups from the Activity box on any lead, deal, company or contact."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((a) => {
              const Icon = ACTIVITY_ICONS[a.type];
              const overdue = !a.completedAt && a.dueAt && a.dueAt < now;
              const manage = canManageActivity(user, a);
              return (
                <li key={a.id} className="group flex items-start gap-3 px-5 py-3">
                  <DoneCheckbox id={a.id} done={Boolean(a.completedAt)} canToggle={manage} label={a.subject} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", a.completedAt ? "text-ink-500 line-through" : "text-ink-900")}>
                      <Icon className="size-4 text-ink-400" aria-label={ACTIVITY_TYPE_LABELS[a.type]} />
                      {a.subject}
                      {a.priority === "HIGH" && !a.completedAt && <Badge tone="amber">{PRIORITY_LABELS.HIGH}</Badge>}
                    </p>
                    <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", overdue ? "font-medium text-red-600" : "text-ink-500")}>
                      <CalendarClock className="size-3.5" aria-hidden />
                      {a.completedAt
                        ? `Done ${formatWhen(a.completedAt)}`
                        : a.dueAt
                          ? `${overdue ? "Overdue · was due" : "Due"} ${formatWhen(a.dueAt)}`
                          : "No due date"}
                      {who === "all" && <span className="text-ink-500">· {a.assignedTo?.name ?? "Unassigned"}</span>}
                    </p>
                    <ActivityContext activity={a} />
                  </div>
                  {manage && <DeleteEntryButton id={a.id} kind="activity" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-500">Times are Sri Lanka time.</p>
    </>
  );
}
