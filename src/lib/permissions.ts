import type { Role } from "@/generated/prisma/enums";

/**
 * Central permission map. Every server action and page checks one of these
 * through `requirePermission()` in auth.ts, so access rules live in one place.
 */
export const PERMISSIONS = {
  "dashboard:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],

  "company:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "company:create": ["ADMIN", "MANAGER", "SALES"],
  "company:update": ["ADMIN", "MANAGER", "SALES"],
  "company:delete": ["ADMIN", "MANAGER"],

  "contact:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "contact:create": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "contact:update": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "contact:delete": ["ADMIN", "MANAGER"],

  "user:manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission) {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Sales",
  SUPPORT: "Support",
  VIEWER: "Viewer",
};
