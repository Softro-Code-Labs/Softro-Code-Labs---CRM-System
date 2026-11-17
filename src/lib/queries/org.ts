import "server-only";
import { db } from "@/lib/db";

/** Softro's details for quotes. Creates the row with defaults the first time. */
export async function getOrgSettings() {
  return db.orgSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
}
