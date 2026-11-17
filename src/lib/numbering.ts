import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Next yearly number like C-2026-0003 or T-2026-0042. Safe when two people save at once. */
export async function nextNumber(tx: Prisma.TransactionClient, prefix: "Q" | "C" | "T", date = new Date()) {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric" }).format(date);
  const key = `${{ Q: "quote", C: "contract", T: "ticket" }[prefix]}-${year}`;
  const counter = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${year}-${String(counter.value).padStart(4, "0")}`;
}
