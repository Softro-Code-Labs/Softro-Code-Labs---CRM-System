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

  "lead:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "lead:create": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "lead:update": ["ADMIN", "MANAGER", "SALES"],
  "lead:delete": ["ADMIN", "MANAGER"],
  "lead:convert": ["ADMIN", "MANAGER", "SALES"],

  "deal:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "deal:create": ["ADMIN", "MANAGER", "SALES"],
  "deal:update": ["ADMIN", "MANAGER", "SALES"],
  "deal:delete": ["ADMIN", "MANAGER"],

  // Activities (calls, WhatsApp, meetings, tasks) and notes
  "activity:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "activity:create": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  // Anyone who can create can tick off their own tasks and delete their own entries;
  // managers can manage everyone's.
  "activity:manage-all": ["ADMIN", "MANAGER"],

  "quote:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "quote:create": ["ADMIN", "MANAGER", "SALES"],
  "quote:update": ["ADMIN", "MANAGER", "SALES"],
  "quote:delete": ["ADMIN", "MANAGER"],
  "product:manage": ["ADMIN", "MANAGER"],
  "org:manage": ["ADMIN"],

  "invoice:view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "invoice:create": ["ADMIN", "MANAGER", "SALES"],
  "invoice:update": ["ADMIN", "MANAGER", "SALES"],
  "invoice:void": ["ADMIN", "MANAGER"],
  "payment:record": ["ADMIN", "MANAGER", "SALES"],
  "payment:delete": ["ADMIN", "MANAGER"],

  "contract:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "contract:manage": ["ADMIN", "MANAGER", "SALES"],
  "contract:delete": ["ADMIN", "MANAGER"],
  "ticket:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "ticket:create": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "ticket:update": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "ticket:delete": ["ADMIN", "MANAGER"],

  "access:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "access:manage": ["ADMIN", "MANAGER", "SALES", "SUPPORT"],
  "access:delete": ["ADMIN", "MANAGER"],

  "report:view": ["ADMIN", "MANAGER", "SALES", "SUPPORT", "VIEWER"],
  "report:export": ["ADMIN", "MANAGER"],

  "settings:view": ["ADMIN", "MANAGER"],
  "user:manage": ["ADMIN"],
  "pipeline:manage": ["ADMIN", "MANAGER"],
  "audit:view": ["ADMIN"],
  "integration:manage": ["ADMIN"],
  "security:manage": ["ADMIN"],
  "system:view": ["ADMIN"],
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

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Everything, including team members and the audit log",
  MANAGER: "Everything except team members; can delete records and edit the pipeline",
  SALES: "Works leads and deals; adds companies, contacts and activities",
  SUPPORT: "Handles support tickets; adds leads, contacts and activities; read-only on deals",
  VIEWER: "Read-only access",
};
