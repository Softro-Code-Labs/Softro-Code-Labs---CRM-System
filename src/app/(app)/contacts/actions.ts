"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { canSee, mayAssignOwner } from "@/lib/visibility";

const NOT_YOURS = "You can't see this contact. It belongs to someone outside your team.";
const OWNER_NOT_ALLOWED = "You can only make yourself the owner, or for managers someone in your team.";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { fullName } from "@/lib/utils";

async function checkCompany(data: ContactInput): Promise<FormState | null> {
  if (!data.companyId) {
    return data.isPrimary ? { errors: { isPrimary: ["Pick a company before marking a primary contact."] } } : null;
  }
  const exists = await db.company.findUnique({ where: { id: data.companyId }, select: { id: true } });
  return exists ? null : { errors: { companyId: ["That company no longer exists."] } };
}

export async function createContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("contact:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const problem = await checkCompany(parsed.data);
  if (problem) return { ...problem, values };

  if (!(await mayAssignOwner(user, parsed.data.ownerId ?? user.id))) return { errors: { ownerId: [OWNER_NOT_ALLOWED] }, values };
  const data = { ...parsed.data, ownerId: parsed.data.ownerId ?? user.id };
  const contact = await db.$transaction(async (tx) => {
    if (data.isPrimary && data.companyId) {
      await tx.contact.updateMany({ where: { companyId: data.companyId, isPrimary: true }, data: { isPrimary: false } });
    }
    return tx.contact.create({ data });
  });
  await audit({ actorId: user.id, action: "create", entity: "Contact", entityId: contact.id, summary: fullName(contact) });

  revalidatePath("/contacts");
  if (contact.companyId) revalidatePath(`/companies/${contact.companyId}`);
  redirect(`/contacts/${contact.id}`);
}

export async function updateContact(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("contact:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const problem = await checkCompany(parsed.data);
  if (problem) return { ...problem, values };

  const existing = await db.contact.findUnique({ where: { id }, select: { companyId: true, ownerId: true } });
  if (!existing) return { message: "This contact no longer exists." };
  if (!(await canSee(user, "contact", id))) return { message: NOT_YOURS, values };
  if (parsed.data.ownerId !== existing.ownerId && !(await mayAssignOwner(user, parsed.data.ownerId))) return { errors: { ownerId: [OWNER_NOT_ALLOWED] }, values };

  const data = parsed.data;
  const contact = await db.$transaction(async (tx) => {
    if (data.isPrimary && data.companyId) {
      await tx.contact.updateMany({
        where: { companyId: data.companyId, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }
    return tx.contact.update({ where: { id }, data });
  });
  await audit({ actorId: user.id, action: "update", entity: "Contact", entityId: id, summary: fullName(contact) });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  for (const companyId of new Set([existing.companyId, contact.companyId])) {
    if (companyId) revalidatePath(`/companies/${companyId}`);
  }
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const user = await authorizeAction("contact:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const contact = await db.contact.findUnique({ where: { id }, select: { firstName: true, lastName: true, companyId: true } });
  if (!contact) return { message: "This contact no longer exists." };
  if (!(await canSee(user, "contact", id))) return { message: NOT_YOURS };

  await db.contact.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Contact", entityId: id, summary: fullName(contact) });

  revalidatePath("/contacts");
  if (contact.companyId) revalidatePath(`/companies/${contact.companyId}`);
  redirect(contact.companyId ? `/companies/${contact.companyId}` : "/contacts");
}
