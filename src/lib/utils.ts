import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** All dates are shown in Sri Lanka time, whatever timezone the server runs in. */
export const APP_TIME_ZONE = "Asia/Colombo";

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatMoney(value: number | string | { toString(): string } | null | undefined, currency = "LKR") {
  if (value === null || value === undefined) return "—";
  const amount = Number(value.toString());
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function fullName(person: { firstName: string; lastName?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Reads a positive page number from search params. */
export function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Totals per currency, e.g. "LKR 1,200,000 + USD 5,000". Never adds different currencies together. */
export function formatMoneyTotals(rows: { currency: string; value: number | string | { toString(): string } }[]) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + Number(row.value.toString()));
  if (totals.size === 0) return formatMoney(0, process.env.DEFAULT_CURRENCY ?? "LKR");
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, value]) => formatMoney(value, currency))
    .join(" + ");
}

export function formatRelative(date: Date, now = new Date()) {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "";
}

export function toDateInput(value: Date | null | undefined) {
  // en-CA formats as yyyy-mm-dd, which <input type="date"> expects.
  return value ? new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date(value)) : "";
}
