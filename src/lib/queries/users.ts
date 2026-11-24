import "server-only";
import { db } from "@/lib/db";

/** Active users who can own records (shown in "Owner" dropdowns). */
export async function getAssignableUsers() {
  return db.user.findMany({
    where: { isActive: true, role: { not: "VIEWER" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Active Managers, for the "Manager (team)" choice on a team member. */
export async function getManagers(exceptId?: string) {
  return db.user.findMany({
    where: { isActive: true, role: "MANAGER", ...(exceptId && { NOT: { id: exceptId } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
