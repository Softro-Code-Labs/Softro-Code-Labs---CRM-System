"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { OPEN_LEAD_STATUSES } from "@/lib/crm-meta";
import { getTeamMember } from "@/lib/team";
import { mayAssignOwner } from "@/lib/visibility";

export type HandOverResult = { ok?: boolean; message?: string };

/**
 * Hands all of a team member's open leads, open deals and unfinished tasks to someone else,
 * e.g. when they go on leave. Managers can only hand work within their own team.
 */
export async function handOverWork(memberId: string, _prev: HandOverResult, formData: FormData): Promise<HandOverResult> {
  const user = await authorizeAction("team:view");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const member = await getTeamMember(user, memberId);
  if (!member) return { message: "This person isn't in your team." };

  const toId = String(formData.get("toId") ?? "");
  if (!toId || toId === memberId) return { message: "Choose who should take over." };
  if (!(await mayAssignOwner(user, toId))) return { message: "You can only hand work to yourself or someone in your team." };
  const to = await db.user.findUnique({ where: { id: toId }, select: { name: true, isActive: true } });
  if (!to?.isActive) return { message: "Choose an active person." };

  const [leads, deals, tasks] = await db.$transaction([
    db.lead.updateMany({ where: { ownerId: memberId, status: { in: OPEN_LEAD_STATUSES } }, data: { ownerId: toId } }),
    db.deal.updateMany({ where: { ownerId: memberId, status: "OPEN" }, data: { ownerId: toId } }),
    db.activity.updateMany({ where: { assignedToId: memberId, completedAt: null }, data: { assignedToId: toId } }),
  ]);
  const summary = `${leads.count} lead${leads.count === 1 ? "" : "s"}, ${deals.count} deal${deals.count === 1 ? "" : "s"} and ${tasks.count} task${tasks.count === 1 ? "" : "s"}`;
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: memberId, summary: `Handed ${member.name}'s open work to ${to.name}: ${summary}` });

  revalidatePath("/team");
  revalidatePath(`/team/${memberId}`);
  revalidatePath("/leads");
  revalidatePath("/deals");
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  return { ok: true, message: `Done: ${summary} now belong to ${to.name}.` };
}
