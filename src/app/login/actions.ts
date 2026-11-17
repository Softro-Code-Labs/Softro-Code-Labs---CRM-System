"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation/auth";
import { zodErrors, type FormState } from "@/lib/form";

// Used to keep response time similar when the email does not exist.
const DUMMY_HASH = "$2b$12$HQom0z/4m8ll5QJf6xd.WuKyGh56TNFEGfwSddKbJzzuskgirDoIe";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site relative paths to prevent open redirects.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");

  if (!parsed.success) {
    return { errors: zodErrors(parsed.error), values: { email } };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid || !user.isActive) {
    return { message: "Incorrect email or password.", values: { email } };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, user.role);
  await audit({ actorId: user.id, action: "login", entity: "User", entityId: user.id });

  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  const session = await getSession();
  if (session) {
    await audit({ actorId: session.userId, action: "logout", entity: "User", entityId: session.userId });
  }
  await deleteSession();
  redirect("/login");
}
