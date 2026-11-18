import "server-only";
import { db } from "@/lib/db";
import { getCompanyOptions } from "@/lib/queries/companies";
import { getContactOptions } from "@/lib/queries/contacts";
import { getAssignableUsers } from "@/lib/queries/users";

export async function getTicketFormOptions() {
  const [companies, contacts, users, contracts] = await Promise.all([
    getCompanyOptions(),
    getContactOptions(),
    getAssignableUsers(),
    db.contract.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { title: "asc" }, select: { id: true, number: true, title: true, companyId: true, responseTimeHours: true } }),
  ]);
  return { companies, contacts, users, contracts: contracts.map((c) => ({ id: c.id, name: `${c.number} · ${c.title}`, companyId: c.companyId, responseTimeHours: c.responseTimeHours })) };
}
