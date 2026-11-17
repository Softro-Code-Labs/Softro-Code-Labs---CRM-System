import "server-only";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { open } from "./secret-box";
import { verifyTotp } from "./totp";
import { hashRecoveryCode, normalizeRecoveryCode } from "./recovery-codes";

/**
 * Two-step sign-in. After the right password, people with an authenticator set up
 * get a short-lived "pending" cookie instead of a session, and must enter a code.
 */
export const PENDING_COOKIE = "softro_2fa";
const PENDING_MINUTES = 5;

/** Roles that must use two-step sign-in when the admin switches the rule on. */
export const TWO_FACTOR_ROLES: Role[] = ["ADMIN", "MANAGER"];

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

type Pending = { userId: string; version: number; next: string; purpose: "2fa" };

export async function setPendingTwoFactor(userId: string, version: number, next: string) {
  const token = await new SignJWT({ userId, version, next, purpose: "2fa" } satisfies Pending)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MINUTES}m`)
    .sign(key());
  (await cookies()).set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/login",
    maxAge: PENDING_MINUTES * 60,
  });
}

export async function getPendingTwoFactor(): Promise<Pending | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Pending>(token, key(), { algorithms: ["HS256"] });
    return payload.purpose === "2fa" ? payload : null;
  } catch {
    return null;
  }
}

export async function clearPendingTwoFactor() {
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/login" });
}

/** Whether the "admins and managers must use two-step sign-in" rule is on. Cached per request. */
export const twoFactorPolicy = cache(async () => {
  const org = await db.orgSettings.findUnique({ where: { id: "default" }, select: { requireTwoFactor: true } });
  return { required: org?.requireTwoFactor ?? false };
});

export async function mustSetUpTwoFactor(user: { role: Role; totpEnabled: boolean }) {
  if (user.totpEnabled || !TWO_FACTOR_ROLES.includes(user.role)) return false;
  return (await twoFactorPolicy()).required;
}

/**
 * Checks a 6-digit code or a recovery code for a user with 2FA on.
 * Accepted codes are used up atomically (the step is stored; recovery codes are removed),
 * so two requests can't both succeed with the same code.
 */
export async function checkSecondFactor(userId: string, input: string): Promise<{ ok: true; usedRecoveryCode: boolean; recoveryCodesLeft: number } | { ok: false }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true, recoveryCodeHashes: true } });
  if (!user?.totpSecret || !user.totpEnabledAt) return { ok: false };
  const code = input.trim();

  if (/^\d{3}\s?\d{3}$/.test(code)) {
    const step = verifyTotp(open(user.totpSecret), code, { lastStep: user.totpLastStep });
    if (step == null) return { ok: false };
    const claimed = await db.user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return claimed.count ? { ok: true, usedRecoveryCode: false, recoveryCodesLeft: user.recoveryCodeHashes.length } : { ok: false };
  }

  if (normalizeRecoveryCode(code).length === 8) {
    const hash = hashRecoveryCode(code);
    if (!user.recoveryCodeHashes.includes(hash)) return { ok: false };
    const left = user.recoveryCodeHashes.filter((h) => h !== hash);
    const claimed = await db.user.updateMany({ where: { id: userId, recoveryCodeHashes: { has: hash } }, data: { recoveryCodeHashes: left } });
    return claimed.count ? { ok: true, usedRecoveryCode: true, recoveryCodesLeft: left.length } : { ok: false };
  }
  return { ok: false };
}
