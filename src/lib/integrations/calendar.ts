import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm-meta";
import { fullName } from "@/lib/utils";
import { appUrl } from "./app-url";

/**
 * Private calendar feed (iCalendar) of a person's open tasks, calls and meetings,
 * for Google Calendar, Outlook or Apple Calendar "subscribe by URL".
 * Only a SHA-256 hash of the token is stored; the link is shown once when it's created.
 */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createCalendarToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.user.update({ where: { id: userId }, data: { calendarTokenHash: hashToken(token) } });
  return { token, url: appUrl(`/api/calendar/${token}.ics`) };
}

const DURATION_MIN: Record<string, number> = { MEETING: 60, CALL: 30, TASK: 30, EMAIL: 15, WHATSAPP: 15, NOTE: 15 };

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
/** RFC 5545 line folding at 75 octets. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  let first = true;
  while (i < bytes.length) {
    let len = first ? 75 : 74;
    // Don't split a multi-byte character (e.g. Sinhala text).
    while (i + len < bytes.length && (bytes[i + len] & 0xc0) === 0x80) len--;
    out.push((first ? "" : " ") + bytes.subarray(i, i + len).toString("utf8"));
    i += len;
    first = false;
  }
  return out.join("\r\n");
}

export async function calendarFeed(token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const user = await db.user.findUnique({ where: { calendarTokenHash: hashToken(token) }, select: { id: true, name: true, isActive: true } });
  if (!user?.isActive) return null;

  const now = Date.now();
  const activities = await db.activity.findMany({
    where: { assignedToId: user.id, completedAt: null, dueAt: { gte: new Date(now - 30 * 86_400_000), lt: new Date(now + 180 * 86_400_000) } },
    orderBy: { dueAt: "asc" },
    take: 500,
    include: {
      lead: { select: { id: true, title: true } },
      deal: { select: { id: true, title: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, phone: true, mobile: true } },
    },
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Softro Code Labs//Softro CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`Softro CRM · ${user.name}`)}`,
    "X-WR-TIMEZONE:Asia/Colombo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const a of activities) {
    const start = a.dueAt!;
    const end = new Date(start.getTime() + (DURATION_MIN[a.type] ?? 30) * 60_000);
    const path = a.deal ? `/deals/${a.deal.id}` : a.lead ? `/leads/${a.lead.id}` : a.company ? `/companies/${a.company.id}` : a.contact ? `/contacts/${a.contact.id}` : "/activities";
    const about = [a.deal && `Deal: ${a.deal.title}`, a.lead && `Lead: ${a.lead.title}`, a.company && `Company: ${a.company.name}`, a.contact && `Contact: ${fullName(a.contact)}${a.contact.mobile || a.contact.phone ? ` (${a.contact.mobile ?? a.contact.phone})` : ""}`].filter(Boolean);
    const description = [...about, a.description ?? "", `Open in Softro CRM: ${appUrl(path)}`].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@softro-crm`,
      `DTSTAMP:${stamp(a.updatedAt)}`,
      `LAST-MODIFIED:${stamp(a.updatedAt)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`${ACTIVITY_TYPE_LABELS[a.type]}: ${a.subject}`)}`,
      `DESCRIPTION:${esc(description)}`,
      `URL:${appUrl(path)}`,
      `PRIORITY:${a.priority === "HIGH" ? 1 : a.priority === "LOW" ? 9 : 5}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
