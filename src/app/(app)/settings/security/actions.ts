"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";

export async function setRequireTwoFactor(required: boolean): Promise<{ ok?: boolean; message: string }> {
  const user = await authorizeAction("security:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  // Avoid locking yourself into a setup screen by surprise: turn it on for yourself first.
  if (required && !user.totpEnabled) return { message: "Turn on two-step sign-in for yourself first (My profile → Two-step sign-in)." };
  await db.orgSettings.upsert({ where: { id: "default" }, update: { requireTwoFactor: required }, create: { id: "default", requireTwoFactor: required } });
  await audit({ actorId: user.id, action: "update", entity: "OrgSettings", summary: `Two-step sign-in ${required ? "required" : "no longer required"} for admins and managers` });
  revalidatePath("/settings/security");
  return { ok: true, message: required ? "Admins and managers without it will be asked to set it up next time they open the CRM." : "No longer required." };
}
