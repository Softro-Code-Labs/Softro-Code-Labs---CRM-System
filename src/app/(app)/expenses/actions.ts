"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { formatMoney } from "@/lib/utils";
import { expenseSchema } from "@/lib/validation/expense";
import { processReceipt, ReceiptError } from "@/lib/expense-receipt";

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/finance");
}

/** Adds an expense (id null) or changes one. A new receipt file replaces the old one; "remove" deletes it. */
export async function saveExpense(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("expense:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const { date, ...rest } = parsed.data;
  const data = { ...rest, date: date! };

  const file = formData.get("receipt");
  let receipt: Awaited<ReturnType<typeof processReceipt>> | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      receipt = await processReceipt(file);
    } catch (e) {
      return { errors: { receipt: [e instanceof ReceiptError ? e.message : "Couldn't read that file."] }, values };
    }
  }
  const removeReceipt = !receipt && values.removeReceipt === "on";

  if (id) {
    const existing = await db.expense.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { message: "This expense no longer exists." };
    await db.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { ...data, ...(receipt && { receiptName: receipt.name, receiptType: receipt.type }), ...(removeReceipt && { receiptName: null, receiptType: null }) },
      });
      if (receipt) await tx.expenseReceipt.upsert({ where: { expenseId: id }, update: { data: receipt.data }, create: { expenseId: id, data: receipt.data } });
      if (removeReceipt) await tx.expenseReceipt.deleteMany({ where: { expenseId: id } });
    });
    await audit({ actorId: user.id, action: "update", entity: "Expense", entityId: id, summary: `${data.description} (${formatMoney(data.amount, "LKR")})` });
    refresh();
    return { ok: true };
  }

  const created = await db.expense.create({
    data: {
      ...data,
      createdById: user.id,
      ...(receipt && { receiptName: receipt.name, receiptType: receipt.type, receipt: { create: { data: receipt.data } } }),
    },
  });
  await audit({ actorId: user.id, action: "create", entity: "Expense", entityId: created.id, summary: `${data.description} (${formatMoney(data.amount, "LKR")})` });
  refresh();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<{ message?: string }> {
  const user = await authorizeAction("expense:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const e = await db.expense.findUnique({ where: { id }, select: { description: true, amount: true } });
  if (!e) return {};
  await db.expense.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Expense", entityId: id, summary: `${e.description} (${formatMoney(e.amount, "LKR")})` });
  refresh();
  return {};
}
