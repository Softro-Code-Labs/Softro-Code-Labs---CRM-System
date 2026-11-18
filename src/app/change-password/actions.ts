"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { changePasswordSchema } from "@/lib/validation/user";
import { zodErrors, type FormState } from "@/lib/form";

/**
 * Changes the signed-in user's password. Used by the forced first-login screen
 * and by My profile. Signs out every other device by bumping sessionVersion.
 */
export async function changePassword(redirectTo: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { errors: zodErrors(parsed.error) };

  const user = await db.user.findUnique({ where: { id: current.id } });
  if (!user) redirect("/login");
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { errors: { currentPassword: ["That isn't your current password"] } };
  }
  if (parsed.data.newPassword.toLowerCase().includes(user.email.split("@")[0].toLowerCase())) {
    return { errors: { newPassword: ["Don't include your email name in your password"] } };
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });
  // Keep this browser signed in with the new session version.
  await createSession(updated.id, updated.role, updated.sessionVersion);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Changed own password" });

  if (redirectTo) redirect(redirectTo);
  return { ok: true, message: undefined };
}
