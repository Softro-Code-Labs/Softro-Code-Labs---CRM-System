import "server-only";
import { db } from "@/lib/db";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getContactOptions } from "@/lib/queries/contacts";
import { getOwnerOptions, getVisibility } from "@/lib/visibility";
import type { Role } from "@/generated/prisma/enums";

export async function getContractFormOptions(viewer: { id: string; role: Role }) {
  const visible = await getVisibility(viewer);
  const [companies, contacts, owners, deals] = await Promise.all([
    getCompanyOptions(viewer),
    getContactOptions(viewer),
    getOwnerOptions(viewer),
    db.deal.findMany({ where: { AND: [visible.deal], companyId: { not: null } }, orderBy: { updatedAt: "desc" }, take: 1000, select: { id: true, title: true, companyId: true, status: true } }),
  ]);
  return { companies, contacts, owners, deals: deals.map((d) => ({ id: d.id, name: `${d.title}${d.status !== "OPEN" ? ` (${d.status.toLowerCase()})` : ""}`, companyId: d.companyId })) };
}
