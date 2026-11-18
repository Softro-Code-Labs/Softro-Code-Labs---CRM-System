import "server-only";
import type { Prisma } from "@/generated/prisma/client";

const COUNTERS = { Q: "quote", C: "contract", T: "ticket", H: "handover", INV: "invoice", RCT: "receipt" } as const;

/** Next yearly number like C-2026-0003, INV-2026-0042 or RCT-2026-0007. Safe when two people save at once. */
export async function nextNumber(tx: Prisma.TransactionClient, prefix: keyof typeof COUNTERS, date = new Date()) {
  const year = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric" }).format(date);
  const key = `${COUNTERS[prefix]}-${year}`;
  const counter = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${prefix}-${year}-${String(counter.value).padStart(4, "0")}`;
}
