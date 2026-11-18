"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { AvatarError, avatarUrl, processAvatar } from "@/lib/avatar";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";

type Result = { ok: true; url: string | null } | { ok: false; message: string };

export async function uploadAvatar(formData: FormData): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const limit = await rateLimit(`avatar:user:${user.id}`, LIMITS.avatarUploadsPerUser.limit, LIMITS.avatarUploadsPerUser.windowSeconds);
  if (!limit.ok) return { ok: false, message: "Too many uploads. Try again in a few minutes." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo first." };
  let data: Uint8Array<ArrayBuffer>;
  try {
    data = new Uint8Array(await processAvatar(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    if (e instanceof AvatarError) return { ok: false, message: e.message };
    throw e;
  }
  const now = new Date();
  await db.$transaction([
    db.userAvatar.upsert({ where: { userId: user.id }, create: { userId: user.id, data }, update: { data } }),
    db.user.update({ where: { id: user.id }, data: { avatarUpdatedAt: now } }),
  ]);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Changed profile photo" });
  revalidatePath("/", "layout");
  return { ok: true, url: avatarUrl({ id: user.id, avatarUpdatedAt: now }) };
}

export async function removeAvatar(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db.$transaction([db.userAvatar.deleteMany({ where: { userId: user.id } }), db.user.update({ where: { id: user.id }, data: { avatarUpdatedAt: null } })]);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Removed profile photo" });
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
