import "server-only";
import { db } from "@/lib/db";

/** Company options for dropdowns. Will become a searchable combobox as data grows. */
export async function getCompanyOptions() {
  return db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 1000 });
}
