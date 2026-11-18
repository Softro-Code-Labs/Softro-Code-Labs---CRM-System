"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { companySchema } from "@/lib/validation/company";
import { formToObject, zodErrors, type FormState } from "@/lib/form";

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("company:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const company = await db.company.create({
    data: { ...parsed.data, ownerId: parsed.data.ownerId ?? user.id },
  });
  await audit({ actorId: user.id, action: "create", entity: "Company", entityId: company.id, summary: company.name });

  revalidatePath("/companies");
  redirect(`/companies/${company.id}`);
}

export async function updateCompany(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("company:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = companySchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const existing = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { message: "This company no longer exists." };

  const company = await db.company.update({ where: { id }, data: parsed.data });
  await audit({ actorId: user.id, action: "update", entity: "Company", entityId: id, summary: company.name });

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  redirect(`/companies/${id}`);
}

export async function deleteCompany(id: string) {
  const user = await authorizeAction("company:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const company = await db.company.findUnique({ where: { id }, select: { name: true } });
  if (!company) return { message: "This company no longer exists." };

  // Contacts and deals stay in the system; their company link is cleared.
  const contracts = await db.contract.count({ where: { companyId: id } });
  if (contracts > 0) return { message: `This company has ${contracts} contract(s). Delete or move them first, or set the company type to Former customer.` };

  await db.company.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Company", entityId: id, summary: company.name });

  revalidatePath("/companies");
  redirect("/companies");
}
