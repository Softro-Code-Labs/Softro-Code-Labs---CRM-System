"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { optionalText } from "@/lib/validation/common";

const months = (label: string) => z.coerce.number({ error: `Enter ${label} in months` }).int(`Whole months only`).min(0).max(120);

const schema = z.object({
  supportMonths: months("the bug-fix period"),
  warrantyMonths: months("the warranty period"),
  warrantyTerms: optionalText(20_000),
  ndaTerms: optionalText(20_000),
});

/** Saves the warranty and NDA wording. Admins only (the same permission as Company details). */
export async function saveDeliveryDocs(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("org:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  await db.orgSettings.upsert({ where: { id: "default" }, update: parsed.data, create: { id: "default", ...parsed.data } });
  await audit({ actorId: user.id, action: "update", entity: "OrgSettings", summary: "Warranty and NDA wording" });
  revalidatePath("/settings/documents");
  return { ok: true };
}
