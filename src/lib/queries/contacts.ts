import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";
import { getVisibility } from "@/lib/visibility";

/** Contact options for dropdowns, limited like companies (see getCompanyOptions). */
export async function getContactOptions(viewer?: { id: string; role: Role }) {
  const where = viewer ? (await getVisibility(viewer)).contact : {};
  const contacts = await db.contact.findMany({
    where,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, companyId: true },
    take: 2000,
  });
  return contacts.map((c) => ({ id: c.id, name: fullName(c), companyId: c.companyId }));
}
