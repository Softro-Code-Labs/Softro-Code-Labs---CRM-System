"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validation/user";
import { formToObject, zodErrors, type FormState } from "@/lib/form";

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
