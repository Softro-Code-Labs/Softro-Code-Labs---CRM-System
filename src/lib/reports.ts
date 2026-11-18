import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ServiceType } from "@/generated/prisma/enums";
import { monthlyValue } from "@/lib/contracts";
import { PERIOD_OPTIONS } from "@/components/reports/period-options";

/**
 * Report maths. Everything is bucketed in Sri Lanka time (UTC+05:30, no DST).
 * Money charts use the main currency only; other currencies are listed separately, never added together.
 */
const OFFSET = 5.5 * 60 * 60 * 1000;
const DAY = 86_400_000;
export const MAIN_CURRENCY = process.env.DEFAULT_CURRENCY ?? "LKR";

export const PERIODS = PERIOD_OPTIONS;
export type PeriodKey = (typeof PERIODS)[number]["value"] | "custom";

export type Period = { key: PeriodKey; from: Date; to: Date; label: string };

/** Midnight (Colombo) at the start of local year/month/day; month may overflow. */
function colombo(y: number, m: number, d = 1) {
  return new Date(Date.UTC(y, m, d) - OFFSET);
}
function local(date: Date) {
  const l = new Date(date.getTime() + OFFSET);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate() };
}
function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = colombo(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" });

/** Reads ?period= (or ?from=&to= as yyyy-mm-dd). `to` is exclusive. Defaults to the last 12 months. */
export function resolvePeriod(params: { period?: string; from?: string; to?: string }, now = new Date()): Period {
  const { y, m } = local(now);
  const q = Math.floor(m / 3) * 3;
  const from = parseDay(params.from);
  const toDay = parseDay(params.to);
  if (from && toDay && toDay >= from) {
    const to = new Date(toDay.getTime() + DAY);
    return { key: "custom", from, to, label: `${dayFmt.format(from)} – ${dayFmt.format(toDay)}` };
  }
  const ranges: Record<Exclude<PeriodKey, "custom">, [Date, Date]> = {
    "this-month": [colombo(y, m), colombo(y, m + 1)],
    "last-month": [colombo(y, m - 1), colombo(y, m)],
    "this-quarter": [colombo(y, q), colombo(y, q + 3)],
    "last-quarter": [colombo(y, q - 3), colombo(y, q)],
    "this-year": [colombo(y, 0), colombo(y + 1, 0)],
    "last-year": [colombo(y - 1, 0), colombo(y, 0)],
    "last-12": [colombo(y, m - 11), colombo(y, m + 1)],
  };
  const key = (PERIODS.find((p) => p.value === params.period)?.value ?? "last-12") as Exclude<PeriodKey, "custom">;
  const [f, t] = ranges[key];
  return { key, from: f, to: t, label: PERIODS.find((p) => p.value === key)!.label };
}

/** One bucket per calendar month the period touches (capped at 24). */
export function monthBuckets(period: Period) {
  const out: { key: string; label: string; start: Date; end: Date }[] = [];
  let { y, m } = local(period.from);
  const fmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Colombo" });
  const fmtY = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "Asia/Colombo" });
  while (out.length < 24) {
    const start = colombo(y, m);
    if (start >= period.to) break;
    const end = colombo(y, m + 1);
    out.push({ key: `${y}-${m}`, label: (m === 0 || out.length === 0 ? fmtY : fmt).format(start), start, end });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}
export function monthKey(date: Date) {
  const { y, m } = local(date);
  return `${y}-${m}`;
}

const num = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

function sumByCurrency(rows: { currency: string; value: number }[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + r.value);
  return [...m.entries()].map(([currency, value]) => ({ currency, value })).sort((a, b) => b.value - a.value);
}

export type ReportFilters = { period: Period; ownerId?: string };

/* ---------------------------------------------------------------- Sales */

export async function salesReport({ period, ownerId }: ReportFilters) {
  const owner = ownerId ? { ownerId } : {};
  const closed = await db.deal.findMany({
    where: { ...owner, status: { in: ["WON", "LOST"] }, closedAt: { gte: period.from, lt: period.to } },
    select: {
      id: true, status: true, value: true, currency: true, serviceType: true, createdAt: true, closedAt: true, lostReason: true,
      company: { select: { id: true, name: true } },
    },
  });
  const won = closed.filter((d) => d.status === "WON");
  const lost = closed.filter((d) => d.status === "LOST");
  const wonMain = won.filter((d) => d.currency === MAIN_CURRENCY);

  const byMonth = new Map<string, number>();
  for (const d of wonMain) byMonth.set(monthKey(d.closedAt!), (byMonth.get(monthKey(d.closedAt!)) ?? 0) + num(d.value));
  const months = monthBuckets(period).map((b) => ({ label: b.label, value: byMonth.get(b.key) ?? 0 }));

  const byService = new Map<ServiceType | "NONE", number>();
  const byClient = new Map<string, { id: string | null; name: string; value: number; count: number }>();
  for (const d of wonMain) {
    const s = d.serviceType ?? "NONE";
    byService.set(s, (byService.get(s) ?? 0) + num(d.value));
    const k = d.company?.id ?? "none";
    const c = byClient.get(k) ?? { id: d.company?.id ?? null, name: d.company?.name ?? "No company", value: 0, count: 0 };
    c.value += num(d.value);
    c.count++;
    byClient.set(k, c);
  }

  const reasons = new Map<string, { label: string; count: number }>();
  for (const d of lost) {
    const label = d.lostReason?.trim() || "No reason given";
    const k = label.toLowerCase();
    const r = reasons.get(k) ?? { label, count: 0 };
    r.count++;
    reasons.set(k, r);
  }

  const cycle = won.map((d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / DAY);

  return {
    wonCount: won.length,
    lostCount: lost.length,
    winRate: pct(won.length, closed.length),
    wonTotals: sumByCurrency(won.map((d) => ({ currency: d.currency, value: num(d.value) }))),
    avgDeal: wonMain.length ? wonMain.reduce((s, d) => s + num(d.value), 0) / wonMain.length : null,
    avgCycleDays: cycle.length ? Math.round(cycle.reduce((a, b) => a + b, 0) / cycle.length) : null,
    months,
    otherCurrencyWon: sumByCurrency(won.filter((d) => d.currency !== MAIN_CURRENCY).map((d) => ({ currency: d.currency, value: num(d.value) }))),
    byService: [...byService.entries()].map(([service, value]) => ({ service, value })).sort((a, b) => b.value - a.value),
    byClient: [...byClient.values()].sort((a, b) => b.value - a.value).slice(0, 8),
    lostReasons: [...reasons.values()].sort((a, b) => b.count - a.count).slice(0, 6),
  };
}

/* ------------------------------------------------------------- Forecast */

/** Open deals by expected close month (next 6 months), with a probability-weighted value. Not tied to the period. */
export async function forecastReport({ ownerId }: { ownerId?: string }, now = new Date()) {
  const deals = await db.deal.findMany({
    where: { status: "OPEN", currency: MAIN_CURRENCY, ...(ownerId && { ownerId }) },
    select: { value: true, expectedCloseDate: true, stage: { select: { probability: true } } },
  });
  const { y, m } = local(now);
  const buckets = monthBuckets({ key: "custom", from: colombo(y, m), to: colombo(y, m + 6), label: "" }).map((b) => ({ ...b, total: 0, weighted: 0, count: 0 }));
  const late = { total: 0, weighted: 0, count: 0 };
  const later = { total: 0, weighted: 0, count: 0 };
  const undated = { total: 0, weighted: 0, count: 0 };
  const thisMonth = colombo(y, m);
  for (const d of deals) {
    const v = num(d.value);
    const w = (v * d.stage.probability) / 100;
    const date = d.expectedCloseDate;
    const target = !date ? undated : date < thisMonth ? late : buckets.find((b) => date >= b.start && date < b.end) ?? later;
    target.total += v;
    target.weighted += w;
    target.count++;
  }
  const totals = deals.reduce((s, d) => ({ total: s.total + num(d.value), weighted: s.weighted + (num(d.value) * d.stage.probability) / 100 }), { total: 0, weighted: 0 });
  return { months: buckets.map(({ label, total, weighted, count }) => ({ label, total, weighted, count })), late, later, undated, ...totals, count: deals.length };
}

/* ---------------------------------------------------------------- Leads */

export async function leadReport({ period, ownerId }: ReportFilters) {
  const leads = await db.lead.findMany({
    where: { createdAt: { gte: period.from, lt: period.to }, ...(ownerId && { ownerId }) },
    select: {
      source: true, status: true, respondBy: true, respondedAt: true, createdAt: true,
      convertedDeal: { select: { status: true, value: true, currency: true } },
    },
  });
  const bySource = new Map<string, { source: string; leads: number; converted: number; won: number; wonValue: number }>();
  for (const l of leads) {
    const r = bySource.get(l.source) ?? { source: l.source, leads: 0, converted: 0, won: 0, wonValue: 0 };
    r.leads++;
    if (l.convertedDeal) r.converted++;
    if (l.convertedDeal?.status === "WON") {
      r.won++;
      if (l.convertedDeal.currency === MAIN_CURRENCY) r.wonValue += num(l.convertedDeal.value);
    }
    bySource.set(l.source, r);
  }
  const replied = leads.filter((l) => l.respondedAt);
  const onTime = replied.filter((l) => !l.respondBy || l.respondedAt! <= l.respondBy);
  const hours = replied.map((l) => (l.respondedAt!.getTime() - l.createdAt.getTime()) / 3_600_000).filter((h) => h >= 0);
  const converted = leads.filter((l) => l.convertedDeal).length;
  return {
    total: leads.length,
    converted,
    conversionRate: pct(converted, leads.length),
    unqualified: leads.filter((l) => l.status === "UNQUALIFIED").length,
    replyOnTimeRate: pct(onTime.length, replied.length),
    notReplied: leads.filter((l) => !l.respondedAt && l.status !== "UNQUALIFIED" && l.status !== "CONVERTED").length,
    medianReplyHours: median(hours),
    bySource: [...bySource.values()].map((r) => ({ ...r, conversionRate: pct(r.converted, r.leads) })).sort((a, b) => b.leads - a.leads),
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* ----------------------------------------------------------------- Team */

export async function teamReport({ period }: ReportFilters) {
  const inPeriod = { gte: period.from, lt: period.to };
  const [users, leads, deals, openDeals, activities, tickets] = await Promise.all([
    db.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    db.lead.findMany({ where: { createdAt: inPeriod, ownerId: { not: null } }, select: { ownerId: true, respondBy: true, respondedAt: true } }),
    db.deal.findMany({ where: { status: { in: ["WON", "LOST"] }, closedAt: inPeriod, ownerId: { not: null } }, select: { ownerId: true, status: true, value: true, currency: true } }),
    db.deal.findMany({ where: { status: "OPEN", currency: MAIN_CURRENCY, ownerId: { not: null } }, select: { ownerId: true, value: true } }),
    db.activity.groupBy({ by: ["assignedToId"], where: { completedAt: inPeriod, assignedToId: { not: null } }, _count: { _all: true } }),
    db.ticket.findMany({ where: { resolvedAt: inPeriod, assignedToId: { not: null } }, select: { assignedToId: true, firstResponseAt: true, responseDueAt: true } }),
  ]);
  return users
    .map((u) => {
      const myLeads = leads.filter((l) => l.ownerId === u.id);
      const replied = myLeads.filter((l) => l.respondedAt);
      const myDeals = deals.filter((d) => d.ownerId === u.id);
      const won = myDeals.filter((d) => d.status === "WON");
      const myTickets = tickets.filter((t) => t.assignedToId === u.id);
      const ticketReplies = myTickets.filter((t) => t.firstResponseAt && t.responseDueAt);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        leads: myLeads.length,
        replyOnTimeRate: pct(replied.filter((l) => !l.respondBy || l.respondedAt! <= l.respondBy).length, replied.length),
        won: won.length,
        lost: myDeals.length - won.length,
        winRate: pct(won.length, myDeals.length),
        wonValue: won.filter((d) => d.currency === MAIN_CURRENCY).reduce((s, d) => s + num(d.value), 0),
        openPipeline: openDeals.filter((d) => d.ownerId === u.id).reduce((s, d) => s + num(d.value), 0),
        activitiesDone: activities.find((a) => a.assignedToId === u.id)?._count._all ?? 0,
        ticketsResolved: myTickets.length,
        ticketSlaRate: pct(ticketReplies.filter((t) => t.firstResponseAt! <= t.responseDueAt!).length, ticketReplies.length),
      };
    })
    .filter((r) => r.leads || r.won || r.lost || r.openPipeline || r.activitiesDone || r.ticketsResolved);
}

/* -------------------------------------------------------------- Support */

export async function supportReport({ period, ownerId }: ReportFilters, now = new Date()) {
  const inPeriod = { gte: period.from, lt: period.to };
  const who: Prisma.TicketWhereInput = ownerId ? { assignedToId: ownerId } : {};
  const [opened, resolved, openNow, contracts, renewals] = await Promise.all([
    db.ticket.findMany({ where: { ...who, createdAt: inPeriod }, select: { priority: true, createdAt: true, firstResponseAt: true, responseDueAt: true, contractId: true } }),
    db.ticket.count({ where: { ...who, resolvedAt: inPeriod } }),
    db.ticket.count({ where: { ...who, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] } } }),
    db.contract.findMany({ where: { status: "ACTIVE" }, select: { amount: true, currency: true, billingCycle: true } }),
    db.contract.count({ where: { status: "ACTIVE", endDate: { gte: now, lt: new Date(now.getTime() + 90 * DAY) } } }),
  ]);
  const replied = opened.filter((t) => t.firstResponseAt && t.responseDueAt);
  const hours = opened.filter((t) => t.firstResponseAt).map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 3_600_000);
  const byPriority = (["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => ({ priority: p, count: opened.filter((t) => t.priority === p).length }));
  const mrr = sumByCurrency(contracts.map((c) => ({ currency: c.currency, value: monthlyValue(c.amount, c.billingCycle) })));
  return {
    opened: opened.length,
    resolved,
    openNow,
    underContract: opened.filter((t) => t.contractId).length,
    slaRate: pct(replied.filter((t) => t.firstResponseAt! <= t.responseDueAt!).length, replied.length),
    medianReplyHours: median(hours),
    byPriority,
    activeContracts: contracts.length,
    mrr,
    renewals90: renewals,
  };
}

/* ------------------------------------------------------------------ CSV */

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v == null) return "";
    let s = String(v);
    // Stop spreadsheet formula injection from client-entered text.
    if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
