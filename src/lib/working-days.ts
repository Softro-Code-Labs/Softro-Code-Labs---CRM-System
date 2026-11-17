/**
 * Working-day maths in Sri Lanka time (Asia/Colombo, UTC+05:30, no DST).
 * Saturdays and Sundays are skipped. Public/poya holidays are not counted yet.
 */
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function colomboWeekday(date: Date) {
  return new Date(date.getTime() + COLOMBO_OFFSET_MS).getUTCDay(); // 0 = Sunday
}

/** Same time of day, `days` working days later. Enquiries made at the weekend count from Monday. */
export function addWorkingDays(start: Date, days: number) {
  let current = new Date(start.getTime());
  // Weekend enquiries: start the clock at Monday, 9:00 Colombo time.
  while ([0, 6].includes(colomboWeekday(current))) {
    current = new Date(current.getTime() + DAY_MS);
    const local = new Date(current.getTime() + COLOMBO_OFFSET_MS);
    local.setUTCHours(9, 0, 0, 0);
    current = new Date(local.getTime() - COLOMBO_OFFSET_MS);
  }
  let added = 0;
  while (added < days) {
    current = new Date(current.getTime() + DAY_MS);
    if (![0, 6].includes(colomboWeekday(current))) added++;
  }
  return current;
}

export const REPLY_WITHIN_WORKING_DAYS = 2;

export type ReplyState = "replied" | "overdue" | "due-soon" | "on-track" | "none";

/** Where a lead stands against Softro's "we reply within 2 working days" promise. */
export function replyState(lead: { respondBy: Date | null; respondedAt: Date | null }, now = new Date()): ReplyState {
  if (lead.respondedAt) return "replied";
  if (!lead.respondBy) return "none";
  const msLeft = lead.respondBy.getTime() - now.getTime();
  if (msLeft < 0) return "overdue";
  if (msLeft < DAY_MS) return "due-soon";
  return "on-track";
}

/** Midnight on the 1st of the current month, Sri Lanka time. */
export function startOfColomboMonth(now = new Date()) {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - COLOMBO_OFFSET_MS);
}

/** "yyyy-mm-ddThh:mm" in Sri Lanka time, for <input type="datetime-local">. */
export function toColomboInput(date: Date) {
  return new Date(date.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 16);
}

/** Default due time for a new task: the next working day at 10:00, Sri Lanka time. */
export function nextWorkingDayAt10(now = new Date()) {
  const next = addWorkingDays(now, 1);
  const local = new Date(next.getTime() + COLOMBO_OFFSET_MS);
  local.setUTCHours(10, 0, 0, 0);
  return new Date(local.getTime() - COLOMBO_OFFSET_MS);
}

/** Start and end of today, Sri Lanka time. */
export function colomboDayBounds(now = new Date()) {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - COLOMBO_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
