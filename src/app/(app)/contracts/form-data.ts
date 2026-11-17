import "server-only";
import { db } from "@/lib/db";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getContactOptions } from "@/lib/queries/contacts";
import { getAssignableUsers } from "@/lib/queries/users";

export async function getContractFormOptions() {
  const [companies, contacts, owners, deals] = await Promise.all([
    getCompanyOptions(),
    getContactOptions(),
    getAssignableUsers(),
    db.deal.findMany({ where: { companyId: { not: null } }, orderBy: { updatedAt: "desc" }, take: 1000, select: { id: true, title: true, companyId: true, status: true } }),
  ]);
  return { companies, contacts, owners, deals: deals.map((d) => ({ id: d.id, name: `${d.title}${d.status !== "OPEN" ? ` (${d.status.toLowerCase()})` : ""}`, companyId: d.companyId })) };
}
