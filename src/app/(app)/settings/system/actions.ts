"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";

export async function resolveError(id: string): Promise<{ message?: string }> {
  const user = await authorizeAction("system:view");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const row = await db.errorEvent.update({ where: { id }, data: { resolvedAt: new Date() } }).catch(() => null);
  if (row) await audit({ actorId: user.id, action: "update", entity: "ErrorEvent", entityId: id, summary: `Marked fixed: ${row.message.slice(0, 120)}` });
  revalidatePath("/settings/system");
  return {};
}
