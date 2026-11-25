"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyTaskAssigned } from "@/lib/integrations/notify";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pathsFor, resolveLinks, type Links } from "@/lib/activities";
import { logActivitySchema, noteSchema, scheduleActivitySchema, targetSchema, type Target } from "@/lib/validation/activity";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import type { ActivityType, Role } from "@/generated/prisma/enums";
import { canSee } from "@/lib/visibility";

const REPLY_TYPES: ActivityType[] = ["CALL", "WHATSAPP", "EMAIL", "MEETING"];

function revalidate(links: Partial<Links>) {
  for (const path of pathsFor(links)) revalidatePath(path);
  if (links.leadId) revalidatePath("/leads");
}

/** The record's links, if it exists and this person can see it (activities can only go on your own or your team's records). */
async function linksFor(target: Target, viewer: { id: string; role: Role }) {
  const parsed = targetSchema.safeParse(target);
  if (!parsed.success) return null;
  const t = parsed.data;
  const visible = t.dealId
    ? await canSee(viewer, "deal", t.dealId)
    : t.leadId
      ? await canSee(viewer, "lead", t.leadId)
      : t.contactId
        ? await canSee(viewer, "contact", t.contactId)
        : t.companyId
          ? await canSee(viewer, "company", t.companyId)
          : false;
  if (!visible) return null;
  return resolveLinks(t);
}

/** A call, WhatsApp, email or meeting with a lead counts as our reply. */
async function markLeadRepliedIfNeeded(leadId: string | null, type: ActivityType) {
  if (!leadId || !REPLY_TYPES.includes(type)) return;
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { respondedAt: true, status: true } });
  if (!lead || lead.respondedAt) return;
  await db.lead.update({
    where: { id: leadId },
    data: { respondedAt: new Date(), status: lead.status === "NEW" ? "CONTACTED" : lead.status },
  });
}

export async function addNote(target: Target, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("activity:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const links = await linksFor(target, user);
  if (!links) return { message: "This record no longer exists." };

  const note = await db.note.create({ data: { ...links, body: parsed.data.body, authorId: user.id } });
  await audit({ actorId: user.id, action: "create", entity: "Note", entityId: note.id });
  revalidate(links);
  return { ok: true };
}

export async function logActivity(target: Target, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("activity:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = logActivitySchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const links = await linksFor(target, user);
  if (!links) return { message: "This record no longer exists." };

  const now = new Date();
  const activity = await db.activity.create({
    data: { ...links, ...parsed.data, completedAt: now, createdById: user.id, assignedToId: user.id },
  });
  await markLeadRepliedIfNeeded(links.leadId, activity.type);
  await audit({ actorId: user.id, action: "create", entity: "Activity", entityId: activity.id, summary: activity.subject });
  revalidate(links);
  return { ok: true };
}

export async function scheduleActivity(target: Target, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("activity:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = scheduleActivitySchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const links = await linksFor(target, user);
  if (!links) return { message: "This record no longer exists." };

  const assignee = parsed.data.assignedToId
    ? await db.user.findFirst({ where: { id: parsed.data.assignedToId, isActive: true }, select: { id: true } })
    : null;
  if (parsed.data.assignedToId && !assignee) return { errors: { assignedToId: ["That person can't be assigned"] }, values };

  const activity = await db.activity.create({
    data: { ...links, ...parsed.data, assignedToId: assignee?.id ?? user.id, createdById: user.id },
  });
  await audit({ actorId: user.id, action: "create", entity: "Activity", entityId: activity.id, summary: `Scheduled: ${activity.subject}` });
  if (activity.assignedToId !== user.id) after(() => notifyTaskAssigned(activity.id, user.id));
  revalidate(links);
  return { ok: true };
}

/** Tick a task off, or un-tick it. Your own tasks, or anyone's if you're a manager. */
export async function toggleActivityDone(id: string) {
  const user = await authorizeAction("activity:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const activity = await db.activity.findUnique({ where: { id } });
  if (!activity || !(await canSee(user, "activity", id))) return { message: "This activity no longer exists." };
  const mine = activity.assignedToId === user.id || activity.createdById === user.id;
  if (!mine && !can(user.role, "activity:manage-all")) return { message: "Only the person it's assigned to (or a manager) can change this." };

  const completedAt = activity.completedAt ? null : new Date();
  await db.activity.update({ where: { id }, data: { completedAt } });
  if (completedAt) await markLeadRepliedIfNeeded(activity.leadId, activity.type);
  await audit({ actorId: user.id, action: "update", entity: "Activity", entityId: id, summary: `${activity.subject}: ${completedAt ? "done" : "reopened"}` });
  revalidate(activity);
}

export async function deleteActivity(id: string) {
  const user = await authorizeAction("activity:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const activity = await db.activity.findUnique({ where: { id } });
  if (!activity || !(await canSee(user, "activity", id))) return { message: "This activity no longer exists." };
  if (activity.createdById !== user.id && !can(user.role, "activity:manage-all")) {
    return { message: "Only the person who added it (or a manager) can delete it." };
  }
  await db.activity.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Activity", entityId: id, summary: activity.subject });
  revalidate(activity);
}

export async function deleteNote(id: string) {
  const user = await authorizeAction("activity:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const note = await db.note.findUnique({ where: { id } });
  if (!note) return { message: "This note no longer exists." };
  // Only on records this person can see (the note's deal, else its lead, contact or company).
  const visible = note.dealId
    ? await canSee(user, "deal", note.dealId)
    : note.leadId
      ? await canSee(user, "lead", note.leadId)
      : note.contactId
        ? await canSee(user, "contact", note.contactId)
        : note.companyId
          ? await canSee(user, "company", note.companyId)
          : user.role === "ADMIN";
  if (!visible) return { message: "This note no longer exists." };
  if (note.authorId !== user.id && !can(user.role, "activity:manage-all")) {
    return { message: "Only the person who wrote it (or a manager) can delete it." };
  }
  await db.note.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Note", entityId: id });
  revalidate(note);
}
