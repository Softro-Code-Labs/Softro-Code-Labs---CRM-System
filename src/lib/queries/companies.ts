import "server-only";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { getVisibility } from "@/lib/visibility";

/**
 * Company options for dropdowns, limited to the companies this person can see.
 * Without a viewer (support tickets, which the whole support team shares) every company is listed.
 */
export async function getCompanyOptions(viewer?: { id: string; role: Role }) {
  const where = viewer ? (await getVisibility(viewer)).company : {};
  return db.company.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 1000 });
}
