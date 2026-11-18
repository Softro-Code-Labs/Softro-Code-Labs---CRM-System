"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { generateTemporaryPassword, hashPassword } from "@/lib/passwords";
import { userSchema } from "@/lib/validation/user";
import { formToObject, zodErrors, type FormState } from "@/lib/form";

export type UserFormState = FormState & { tempPassword?: string; createdId?: string };

/** True if removing admin rights from `userId` would leave no active admin. */
async function isLastActiveAdmin(userId: string) {
  const others = await db.user.count({ where: { role: "ADMIN", isActive: true, NOT: { id: userId } } });
  return others === 0;
}

function refresh(id?: string) {
  revalidatePath("/settings/users");
  if (id) revalidatePath(`/settings/users/${id}`);
}

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await authorizeAction("user:manage");
  if (!admin) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = userSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  if (await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } })) {
    return { errors: { email: ["Someone already uses this email"] }, values };
  }

  const tempPassword = generateTemporaryPassword();
  const user = await db.user.create({
    data: { ...parsed.data, passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  await audit({ actorId: admin.id, action: "create", entity: "User", entityId: user.id, summary: `${user.name} (${user.role})` });
  refresh();
  return { ok: true, tempPassword, createdId: user.id, values: { name: user.name, email: user.email } };
}

export async function updateUser(id: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await authorizeAction("user:manage");
  if (!admin) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = userSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return { message: "This person no longer exists." };

  const clash = await db.user.findFirst({ where: { email: parsed.data.email, NOT: { id } }, select: { id: true } });
  if (clash) return { errors: { email: ["Someone else already uses this email"] }, values };

  if (existing.role === "ADMIN" && parsed.data.role !== "ADMIN") {
    if (id === admin.id) return { errors: { role: ["You can't remove your own admin rights. Ask another admin."] }, values };
    if (await isLastActiveAdmin(id)) return { errors: { role: ["There must always be at least one admin."] }, values };
  }

  const roleChanged = existing.role !== parsed.data.role;
  await db.user.update({
    where: { id },
    // A role change signs them out so the new permissions apply straight away.
    data: { ...parsed.data, ...(roleChanged && { sessionVersion: { increment: 1 } }) },
  });
  await audit({
    actorId: admin.id,
    action: "update",
    entity: "User",
    entityId: id,
    summary: roleChanged ? `${parsed.data.name}: role ${existing.role} → ${parsed.data.role}` : `${parsed.data.name}: details updated`,
  });
  refresh(id);
  return { ok: true };
}

export async function resetUserPassword(id: string): Promise<{ message?: string; tempPassword?: string }> {
  const admin = await authorizeAction("user:manage");
  if (!admin) return { message: FORBIDDEN_MESSAGE };
  if (id === admin.id) return { message: "Change your own password from My profile." };

  const user = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!user) return { message: "This person no longer exists." };

  const tempPassword = generateTemporaryPassword();
  await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      sessionVersion: { increment: 1 }, // signs them out everywhere
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await audit({ actorId: admin.id, action: "update", entity: "User", entityId: id, summary: `${user.name}: password reset by admin` });
  refresh(id);
  return { tempPassword };
}

export async function setUserActive(id: string, active: boolean): Promise<{ message?: string }> {
  const admin = await authorizeAction("user:manage");
  if (!admin) return { message: FORBIDDEN_MESSAGE };
  if (id === admin.id) return { message: "You can't deactivate yourself." };

  const user = await db.user.findUnique({ where: { id }, select: { name: true, role: true } });
  if (!user) return { message: "This person no longer exists." };
  if (!active && user.role === "ADMIN" && (await isLastActiveAdmin(id))) return { message: "There must always be at least one active admin." };

  await db.user.update({
    where: { id },
    data: { isActive: active, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
  });
  await audit({ actorId: admin.id, action: "update", entity: "User", entityId: id, summary: `${user.name}: ${active ? "reactivated" : "deactivated"}` });
  refresh(id);
  return {};
}

/** For someone who lost their phone and their recovery codes. Signs them out; they set it up again. */
export async function resetUserTwoFactor(id: string): Promise<{ message?: string }> {
  const admin = await authorizeAction("user:manage");
  if (!admin) return { message: FORBIDDEN_MESSAGE };
  if (id === admin.id) return { message: "Use My profile to change your own two-step sign-in." };
  const user = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!user) return { message: "This person no longer exists." };
  await db.user.update({
    where: { id },
    data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: { increment: 1 } },
  });
  await audit({ actorId: admin.id, action: "update", entity: "User", entityId: id, summary: `${user.name}: two-step sign-in reset by admin` });
  refresh(id);
  return {};
}

export async function unlockUser(id: string): Promise<{ message?: string }> {
  const admin = await authorizeAction("user:manage");
  if (!admin) return { message: FORBIDDEN_MESSAGE };
  await db.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await audit({ actorId: admin.id, action: "update", entity: "User", entityId: id, summary: "Unlocked sign-in" });
  refresh(id);
  return {};
}

