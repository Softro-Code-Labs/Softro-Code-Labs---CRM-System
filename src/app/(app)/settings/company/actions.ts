"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { orgSettingsSchema } from "@/lib/validation/quote";
import { formToObject, zodErrors, type FormState } from "@/lib/form";

export async function saveOrgSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("org:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = orgSettingsSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  await db.orgSettings.upsert({ where: { id: "default" }, update: parsed.data, create: { id: "default", ...parsed.data } });
  await audit({ actorId: user.id, action: "update", entity: "OrgSettings", summary: "Company details for quotes and invoices" });
  revalidatePath("/settings/company");
  revalidatePath("/quotes", "layout");
  revalidatePath("/invoices", "layout");
  return { ok: true };
}
