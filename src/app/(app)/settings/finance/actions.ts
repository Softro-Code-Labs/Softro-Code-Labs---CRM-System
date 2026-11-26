"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { commissionRatesSchema } from "@/lib/validation/finance";

/** Commission rates. New rates apply to payments recorded after saving; earned commission keeps its rate. */
export async function saveFinanceRates(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("org:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = commissionRatesSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const r = parsed.data;
  await db.orgSettings.upsert({ where: { id: "default" }, update: r, create: { id: "default", ...r } });
  await audit({
    actorId: user.id,
    action: "update",
    entity: "OrgSettings",
    summary: `Commission ${r.commissionSalesPercent}% + manager ${r.commissionManagerPercent}% (Manager/Admin sale ${r.commissionLeaderPercent}%)`,
  });
  revalidatePath("/settings/finance");
  revalidatePath("/commissions");
  return { ok: true };
}
