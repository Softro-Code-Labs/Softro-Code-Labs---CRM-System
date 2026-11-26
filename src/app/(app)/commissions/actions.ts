"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

/**
 * Admins mark commission paid once the money has gone to the person (with their salary, usually).
 * Marking unpaid undoes a mistake, and is needed before the payment it came from can be cancelled.
 */
export async function setCommissionsPaid(ids: string[], paid: boolean): Promise<{ message?: string }> {
  const user = await authorizeAction("commission:pay");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  if (!ids.length || ids.length > 1000) return {};
  const rows = await db.commission.findMany({ where: { id: { in: ids }, paidAt: paid ? null : { not: null } }, select: { id: true, amount: true } });
  if (!rows.length) return {};
  await db.commission.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: paid ? { paidAt: new Date(), paidById: user.id } : { paidAt: null, paidById: null } });
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  await audit({ actorId: user.id, action: "update", entity: "Commission", summary: `Marked ${rows.length} commission ${rows.length === 1 ? "line" : "lines"} ${paid ? "paid" : "unpaid"} (${formatMoney(total, "LKR")})`, meta: { ids: rows.map((r) => r.id) } });
  revalidatePath("/commissions");
  return {};
}

