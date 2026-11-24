"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { processSignature, SignatureError } from "@/lib/signature";
import { signatureDataUrl } from "@/lib/signature-url";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";

type Result = { ok: true; url: string | null } | { ok: false; message: string };

/** Saves the signature printed on documents this person seals. Admins and Managers only. */
export async function uploadSignature(formData: FormData): Promise<Result> {
  const user = await authorizeAction("document:seal");
  if (!user) return { ok: false, message: FORBIDDEN_MESSAGE };
  const limit = await rateLimit(`signature:user:${user.id}`, LIMITS.avatarUploadsPerUser.limit, LIMITS.avatarUploadsPerUser.windowSeconds);
  if (!limit.ok) return { ok: false, message: "Too many uploads. Try again in a few minutes." };

  const file = formData.get("signature");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image or draw your signature first." };
  let data: Uint8Array<ArrayBuffer>;
  try {
    data = new Uint8Array(await processSignature(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    if (e instanceof SignatureError) return { ok: false, message: e.message };
    throw e;
  }
  await db.$transaction([
    db.userSignature.upsert({ where: { userId: user.id }, create: { userId: user.id, data }, update: { data } }),
    db.user.update({ where: { id: user.id }, data: { signatureUpdatedAt: new Date() } }),
  ]);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Changed signature" });
  revalidatePath("/settings/profile");
  return { ok: true, url: signatureDataUrl(data) };
}

/** Removes the saved signature. Documents already sealed keep the signature they were sealed with. */
export async function removeSignature(): Promise<Result> {
  const user = await authorizeAction("document:seal");
  if (!user) return { ok: false, message: FORBIDDEN_MESSAGE };
  await db.$transaction([db.userSignature.deleteMany({ where: { userId: user.id } }), db.user.update({ where: { id: user.id }, data: { signatureUpdatedAt: null } })]);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Removed signature" });
  revalidatePath("/settings/profile");
  return { ok: true, url: null };
}
