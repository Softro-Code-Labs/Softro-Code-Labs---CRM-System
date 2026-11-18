import "server-only";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { DEFAULT_RESPONSE_HOURS, OPEN_TICKET_STATUSES } from "@/lib/crm-meta";

/** When we must first reply: the contract's SLA, or our standard time for the priority. */
export function responseDue(createdAt: Date, priority: TicketPriority, contractHours: number | null | undefined) {
  const hours = contractHours ?? DEFAULT_RESPONSE_HOURS[priority];
  return new Date(createdAt.getTime() + hours * 3_600_000);
}

export type SlaState = "met" | "late-reply" | "overdue" | "due-soon" | "on-track" | "none";

export function slaState(t: { status: TicketStatus; responseDueAt: Date | null; firstResponseAt: Date | null }, now = new Date()): SlaState {
  if (!t.responseDueAt) return "none";
  if (t.firstResponseAt) return t.firstResponseAt <= t.responseDueAt ? "met" : "late-reply";
  if (!OPEN_TICKET_STATUSES.includes(t.status)) return "none";
  const left = t.responseDueAt.getTime() - now.getTime();
  if (left < 0) return "overdue";
  if (left < 4 * 3_600_000) return "due-soon";
  return "on-track";
}
