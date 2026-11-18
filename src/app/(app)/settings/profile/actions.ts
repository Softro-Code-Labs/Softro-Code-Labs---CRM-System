"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validation/user";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { emailConfigured } from "@/lib/integrations/email";
import { sendDigest } from "@/lib/integrations/digest";
import { createCalendarToken } from "@/lib/integrations/calendar";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const values = formToObject(formData);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  await db.user.update({ where: { id: user.id }, data: parsed.data });
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Updated own profile" });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------- Notifications & calendar */

export async function updateNotificationPrefs(prefs: { emailNotifications: boolean; dailyDigest: boolean }): Promise<{ message?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db.user.update({ where: { id: user.id }, data: { emailNotifications: Boolean(prefs.emailNotifications), dailyDigest: Boolean(prefs.dailyDigest) } });
  revalidatePath("/settings/profile");
  return {};
}

export async function sendMyDigestNow(): Promise<{ ok?: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!emailConfigured()) return { message: "Email isn't set up yet. Ask an admin to connect Resend (Settings → Integrations)." };
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true } });
  const result = await sendDigest(me, new Date(), { evenIfEmpty: true });
  return result?.ok ? { ok: true, message: `Sent to ${me.email}. It can take a minute to arrive.` } : { message: `Couldn't send: ${result && !result.ok ? result.error : "unknown error"}` };
}

export async function createCalendarLink(): Promise<{ url: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { url } = await createCalendarToken(user.id);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Created a new calendar link (old link stops working)" });
  revalidatePath("/settings/profile");
  return { url };
}

export async function removeCalendarLink(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db.user.update({ where: { id: user.id }, data: { calendarTokenHash: null } });
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Turned off calendar link" });
  revalidatePath("/settings/profile");
}
