import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(entry: {
  actorId: string | null;
  action: "create" | "update" | "delete" | "login" | "logout" | "export";
  entity: string;
  entityId?: string | null;
  summary?: string;
  meta?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({ data: entry });
  } catch (error) {
    // Never block the user's action because the audit write failed.
    console.error("audit log write failed", error);
  }
}
