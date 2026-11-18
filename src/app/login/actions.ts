"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation/auth";
import { zodErrors, type FormState } from "@/lib/form";
import { clientIp } from "@/lib/security/client-ip";
import { LIMITS, rateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { checkSecondFactor, clearPendingTwoFactor, getPendingTwoFactor, setPendingTwoFactor } from "@/lib/security/two-factor";

// Used to keep response time similar when the email does not exist.
const DUMMY_HASH = "$2b$12$HQom0z/4m8ll5QJf6xd.WuKyGh56TNFEGfwSddKbJzzuskgirDoIe";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site relative paths to prevent open redirects.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");

  if (!parsed.success) {
    return { errors: zodErrors(parsed.error), values: { email } };
  }

  // Slow down password guessing across many accounts from one address.
  const ip = clientIp(await headers());
  const ipLimit = await rateLimit(`login:ip:${ip}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSeconds);
  if (!ipLimit.ok) {
    const minutes = Math.ceil(ipLimit.retryAfterSeconds / 60);
    return { message: `Too many sign-in attempts from this network. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, values: { email } };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const now = new Date();

  // After 5 wrong passwords the account is locked for 15 minutes.
  if (user?.lockedUntil && user.lockedUntil > now) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
    return { message: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask an admin to reset your password.`, values: { email } };
  }

  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid || !user.isActive) {
    if (user && user.isActive && !valid) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null },
      });
      if (lock) {
        await audit({ actorId: user.id, action: "update", entity: "User", entityId: user.id, summary: "Locked after too many wrong passwords" });
        return { message: `Too many wrong passwords. Your account is locked for ${LOCK_MINUTES} minutes.`, values: { email } };
      }
    }
    return { message: "Incorrect email or password.", values: { email } };
  }

  await resetRateLimit(`login:ip:${ip}`);
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });

  // Two-step sign-in: the password was right, now ask for the authenticator code.
  if (user.totpEnabledAt) {
    await setPendingTwoFactor(user.id, user.sessionVersion, safeNext(formData.get("next")));
    redirect("/login/verify");
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
  await createSession(user.id, user.role, user.sessionVersion);
  await audit({ actorId: user.id, action: "login", entity: "User", entityId: user.id });

  redirect(user.mustChangePassword ? "/change-password" : safeNext(formData.get("next")));
}

export async function logout() {
  const session = await getSession();
  if (session) {
    await audit({ actorId: session.userId, action: "logout", entity: "User", entityId: session.userId });
  }
  await deleteSession();
  redirect("/login");
}

export async function verifySecondFactor(_prev: FormState, formData: FormData): Promise<FormState> {
  const pending = await getPendingTwoFactor();
  if (!pending) redirect("/login?expired=1");

  const limit = await rateLimit(`2fa:user:${pending.userId}`, LIMITS.twoFactorPerUser.limit, LIMITS.twoFactorPerUser.windowSeconds);
  if (!limit.ok) {
    await clearPendingTwoFactor();
    await audit({ actorId: pending.userId, action: "update", entity: "User", entityId: pending.userId, summary: "Too many wrong two-step codes" });
    return { message: `Too many wrong codes. Wait ${Math.ceil(limit.retryAfterSeconds / 60)} minutes, then sign in again.` };
  }

  const code = String(formData.get("code") ?? "");
  const user = await db.user.findUnique({ where: { id: pending.userId }, select: { id: true, role: true, isActive: true, sessionVersion: true, mustChangePassword: true } });
  if (!user || !user.isActive || user.sessionVersion !== pending.version) {
    await clearPendingTwoFactor();
    redirect("/login");
  }
  const result = await checkSecondFactor(user.id, code);
  if (!result.ok) return { errors: { code: ["That code didn't work. Check the time on your phone is set automatically."] } };

  await resetRateLimit(`2fa:user:${user.id}`);
  await clearPendingTwoFactor();
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, user.role, user.sessionVersion);
  await audit({
    actorId: user.id,
    action: "login",
    entity: "User",
    entityId: user.id,
    summary: result.usedRecoveryCode ? `Signed in with a recovery code (${result.recoveryCodesLeft} left)` : undefined,
  });
  redirect(user.mustChangePassword ? "/change-password" : result.usedRecoveryCode ? "/settings/profile?recovery=1" : pending.next);
}

export async function cancelSecondFactor() {
  await clearPendingTwoFactor();
  redirect("/login");
}
