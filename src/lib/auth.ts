import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can, type Permission } from "@/lib/permissions";
import { mustSetUpTwoFactor } from "@/lib/security/two-factor";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: import("@/generated/prisma/enums").Role;
  mustChangePassword: boolean;
  totpEnabled: boolean;
};

/**
 * Data Access Layer: the single place that turns the session cookie into a
 * user. Always re-checks the database, so deactivated users lose access
 * immediately even if their cookie is still valid.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true, sessionVersion: true, mustChangePassword: true, totpEnabledAt: true },
  });
  // Deactivated users, and sessions from before a password change or reset, are signed out.
  if (!user || !user.isActive || user.sessionVersion !== (session.version ?? 0)) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, totpEnabled: Boolean(user.totpEnabledAt) };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For pages inside the app: sends people with a temporary password to change it first,
 * and admins/managers to set up two-step sign-in when the company requires it.
 */
export async function requireActiveUser() {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (await mustSetUpTwoFactor(user)) redirect("/setup-two-factor");
  return user;
}

/** Use in pages: redirects to the dashboard when the role is not allowed. */
export async function requirePermission(permission: Permission) {
  const user = await requireActiveUser();
  if (!can(user.role, permission)) redirect("/dashboard?denied=1");
  return user;
}

export const FORBIDDEN_MESSAGE = "You do not have permission to do this.";

/**
 * Use in server actions. Redirects to login when signed out; returns null when
 * the role lacks the permission so the action can return a friendly message
 * (thrown errors are hidden from the browser in production).
 */
export async function authorizeAction(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (await mustSetUpTwoFactor(user)) redirect("/setup-two-factor");
  return can(user.role, permission) ? user : null;
}
