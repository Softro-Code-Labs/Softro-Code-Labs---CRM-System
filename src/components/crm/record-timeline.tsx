import Link from "next/link";
import { CalendarClock, Mail, MessageCircle, MessageSquareText, Phone, SquareCheck, Users } from "lucide-react";
import type { ActivityType } from "@/generated/prisma/enums";
import { getTimeline, type ActivityRow } from "@/lib/activities";
import { getAssignableUsers } from "@/lib/queries/users";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import type { Target } from "@/lib/validation/activity";
import { ACTIVITY_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/crm-meta";
import { cn, APP_TIME_ZONE } from "@/lib/utils";
import { nextWorkingDayAt10, toColomboInput } from "@/lib/working-days";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityComposer } from "./activity-composer";
import { DeleteEntryButton, DoneCheckbox } from "./activity-controls";

export const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: Users,
  TASK: SquareCheck,
};

export function formatWhen(date: Date) {
  return date.toLocaleString("en-GB", { timeZone: APP_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Small links to the other records an activity belongs to (shown outside its own page). */
export function ActivityContext({ activity, hide }: { activity: ActivityRow; hide?: keyof Target }) {
  const links = [
    hide !== "dealId" && activity.deal && { href: `/deals/${activity.deal.id}`, label: activity.deal.title },
    hide !== "leadId" && activity.lead && { href: `/leads/${activity.lead.id}`, label: activity.lead.title },
    hide !== "companyId" && !activity.deal && activity.company && { href: `/companies/${activity.company.id}`, label: activity.company.name },
    hide !== "contactId" && !activity.deal && activity.contact && {
      href: `/contacts/${activity.contact.id}`,
      label: [activity.contact.firstName, activity.contact.lastName].filter(Boolean).join(" "),
    },
  ].filter(Boolean) as { href: string; label: string }[];
  if (!links.length) return null;
  return (
    <span className="text-xs text-ink-500">
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 && " · "}
          <Link href={l.href} className="hover:text-brand-700">
            {l.label}
          </Link>
        </span>
      ))}
    </span>
  );
}

export function canManageActivity(user: CurrentUser, a: { assignedToId: string | null; createdById: string | null }) {
  return can(user.role, "activity:manage-all") || (can(user.role, "activity:create") && (a.assignedToId === user.id || a.createdById === user.id));
}

/** Timeline + "add" box shown on lead, deal, company and contact pages. */
export async function RecordTimeline({ target, user }: { target: Target; user: CurrentUser }) {
  const [{ upcoming, history }, users] = await Promise.all([getTimeline(target), getAssignableUsers()]);
  const now = new Date();
  const hide = (Object.keys(target) as (keyof Target)[]).find((k) => target[k]);
  const canCreate = can(user.role, "activity:create");

  return (
    <Card>
      <CardHeader title="Activity" description="Notes, calls, WhatsApp chats, meetings and tasks." />
      {canCreate && (
        <div className="border-b border-ink-100">
          <ActivityComposer target={target} users={users} currentUserId={user.id} defaultDueAt={toColomboInput(nextWorkingDayAt10(now))} />
        </div>
      )}

      {upcoming.length > 0 && (
        <section aria-label="Upcoming" className="border-b border-ink-100">
          <h3 className="px-5 pt-4 text-xs font-semibold tracking-wide text-ink-500 uppercase">Upcoming</h3>
          <ul className="divide-y divide-ink-100">
            {upcoming.map((a) => {
              const Icon = ACTIVITY_ICONS[a.type];
              const overdue = a.dueAt && a.dueAt < now;
              return (
                <li key={a.id} className="group flex items-start gap-3 px-5 py-3">
                  <DoneCheckbox id={a.id} done={false} canToggle={canManageActivity(user, a)} label={a.subject} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                      <Icon className="size-4 text-ink-400" aria-label={ACTIVITY_TYPE_LABELS[a.type]} />
                      {a.subject}
                      {a.priority === "HIGH" && <Badge tone="amber">{PRIORITY_LABELS.HIGH}</Badge>}
                    </p>
                    {a.description && <p className="mt-0.5 text-sm whitespace-pre-line text-ink-600">{a.description}</p>}
                    <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", overdue ? "font-medium text-red-600" : "text-ink-500")}>
                      <CalendarClock className="size-3.5" aria-hidden />
                      {a.dueAt ? `${overdue ? "Overdue · was due" : "Due"} ${formatWhen(a.dueAt)}` : "No due date"}
                      <span className="text-ink-500">· {a.assignedTo?.name ?? "Unassigned"}</span>
                    </p>
                    <ActivityContext activity={a} hide={hide} />
                  </div>
                  {canManageActivity(user, a) && <DeleteEntryButton id={a.id} kind="activity" />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="History">
        {upcoming.length > 0 && history.length > 0 && <h3 className="px-5 pt-4 text-xs font-semibold tracking-wide text-ink-500 uppercase">History</h3>}
        {history.length === 0 && upcoming.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-500">Nothing here yet. Add a note or log your first conversation above.</p>
        ) : (
          <ol className="divide-y divide-ink-100">
            {history.map((item) => {
              if (item.kind === "note") {
                const n = item.note;
                return (
                  <li key={`n-${n.id}`} className="group flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                      <MessageSquareText className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm whitespace-pre-line text-ink-800">{n.body}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        Note by {n.author?.name ?? "someone"} · {formatWhen(n.createdAt)}
                      </p>
                    </div>
                    {(n.authorId === user.id || can(user.role, "activity:manage-all")) && <DeleteEntryButton id={n.id} kind="note" />}
                  </li>
                );
              }
              const a = item.activity;
              const Icon = ACTIVITY_ICONS[a.type];
              return (
                <li key={`a-${a.id}`} className="group flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">
                      <span className="font-medium">{ACTIVITY_TYPE_LABELS[a.type]}:</span> {a.subject}
                    </p>
                    {a.description && <p className="mt-0.5 text-sm whitespace-pre-line text-ink-600">{a.description}</p>}
                    <p className="mt-1 text-xs text-ink-500">
                      {a.assignedTo?.name ?? a.createdBy?.name ?? "Someone"} · {formatWhen(item.at)}
                      {a.dueAt && " · was scheduled"}
                    </p>
                    <ActivityContext activity={a} hide={hide} />
                  </div>
                  {a.dueAt && <DoneCheckbox id={a.id} done canToggle={canManageActivity(user, a)} label={a.subject} />}
                  {canManageActivity(user, a) && <DeleteEntryButton id={a.id} kind="activity" />}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </Card>
  );
}
