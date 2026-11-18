import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";

export async function getContactOptions() {
  const contacts = await db.contact.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, companyId: true },
    take: 2000,
  });
  return contacts.map((c) => ({ id: c.id, name: fullName(c), companyId: c.companyId }));
}
