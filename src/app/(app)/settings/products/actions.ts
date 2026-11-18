"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { productSchema } from "@/lib/validation/quote";
import { formToObject, zodErrors, type FormState } from "@/lib/form";

/** Create when id is empty, otherwise update. */
export async function saveProduct(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("product:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const product = id
    ? await db.product.update({ where: { id }, data: parsed.data })
    : await db.product.create({ data: parsed.data });
  await audit({ actorId: user.id, action: id ? "update" : "create", entity: "Product", entityId: product.id, summary: product.name });
  revalidatePath("/settings/products");
  return { ok: true };
}

/** Archived items stay on old quotes but can't be added to new ones. */
export async function setProductActive(id: string, isActive: boolean) {
  const user = await authorizeAction("product:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const product = await db.product.update({ where: { id }, data: { isActive } });
  await audit({ actorId: user.id, action: "update", entity: "Product", entityId: id, summary: `${product.name}: ${isActive ? "restored" : "archived"}` });
  revalidatePath("/settings/products");
}
