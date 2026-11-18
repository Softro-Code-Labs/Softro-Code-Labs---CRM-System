"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { open, seal } from "@/lib/security/secret-box";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/security/totp";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/security/recovery-codes";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import { checkSecondFactor, TWO_FACTOR_ROLES, twoFactorPolicy } from "@/lib/security/two-factor";

async function me() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

async function limited(userId: string) {
  const r = await rateLimit(`2fa:user:${userId}`, LIMITS.twoFactorPerUser.limit, LIMITS.twoFactorPerUser.windowSeconds);
  return r.ok ? null : `Too many attempts. Wait ${Math.ceil(r.retryAfterSeconds / 60)} minutes and try again.`;
}

const group = (s: string) => s.match(/.{1,4}/g)!.join(" ");

/** Step 1: make a secret and show it as a QR code. Not switched on until a code is confirmed. */
export async function startTwoFactorSetup(): Promise<{ qrSvg: string; secret: string } | { error: string }> {
  const user = await me();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabledAt: true, email: true } });
  if (row.totpEnabledAt) return { error: "Two-step sign-in is already on." };
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: seal(secret), totpLastStep: null } });
  const qrSvg = await QRCode.toString(otpauthUrl(secret, row.email), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } });
  return { qrSvg, secret: group(secret) };
}

/** Step 2: the first code from the app proves it's set up. Returns recovery codes, shown once. */
export async function confirmTwoFactorSetup(code: string): Promise<{ recoveryCodes: string[] } | { error: string }> {
  const user = await me();
  const tooMany = await limited(user.id);
  if (tooMany) return { error: tooMany };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabledAt: true, sessionVersion: true } });
  if (row.totpEnabledAt) return { error: "Two-step sign-in is already on." };
  if (!row.totpSecret) return { error: "Start again: click “Set up two-step sign-in”." };
  const step = verifyTotp(open(row.totpSecret), code);
  if (step == null) return { error: "That code didn't work. Enter the current 6-digit code from the app." };

  const recoveryCodes = generateRecoveryCodes();
  const updated = await db.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true, role: true },
  });
  // Other devices are signed out; this one stays signed in.
  await createSession(user.id, updated.role, updated.sessionVersion);
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Turned on two-step sign-in" });
  revalidatePath("/settings/profile");
  return { recoveryCodes };
}

export async function newRecoveryCodes(code: string): Promise<{ recoveryCodes: string[] } | { error: string }> {
  const user = await me();
  const tooMany = await limited(user.id);
  if (tooMany) return { error: tooMany };
  const check = await checkSecondFactor(user.id, code);
  if (!check.ok || check.usedRecoveryCode) return { error: "Enter the current 6-digit code from your authenticator app." };
  const recoveryCodes = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) } });
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Made new recovery codes" });
  revalidatePath("/settings/profile");
  return { recoveryCodes };
}

export async function turnOffTwoFactor(code: string): Promise<{ ok: true } | { error: string }> {
  const user = await me();
  if (TWO_FACTOR_ROLES.includes(user.role) && (await twoFactorPolicy()).required) {
    return { error: "Two-step sign-in is required for your role, so it can't be turned off. Use “New recovery codes” or ask an admin to reset it if you change phone." };
  }
  const tooMany = await limited(user.id);
  if (tooMany) return { error: tooMany };
  const check = await checkSecondFactor(user.id, code);
  if (!check.ok) return { error: "That code didn't work." };
  await db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [] } });
  await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Turned off two-step sign-in" });
  revalidatePath("/settings/profile");
  return { ok: true };
}
