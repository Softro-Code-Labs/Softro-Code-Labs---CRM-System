/** Pure helpers for the plan-usage panel (no database), so they can be unit tested. */

export type UsageLevel = "ok" | "warn" | "full" | "unknown";

/** Warn from 80%, "nearly full" from 95%. */
export function usageLevel(used: number | null, limit: number | null): UsageLevel {
  if (used == null || !limit) return "unknown";
  const pct = used / limit;
  return pct >= 0.95 ? "full" : pct >= 0.8 ? "warn" : "ok";
}

export function usagePercent(used: number | null, limit: number | null) {
  if (used == null || !limit) return null;
  return Math.min(100, Math.round((used / limit) * 1000) / 10);
}

export function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? v : v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** A plan limit from the environment, e.g. PLAN_DB_STORAGE_MB=1024. Falls back to the free-plan value. */
export function planLimit(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** How far through the usage period we are, to tell "on track" from "will run out". */
export function projectedUse(used: number, periodStart: Date, periodEnd: Date, now = new Date()) {
  const total = periodEnd.getTime() - periodStart.getTime();
  const done = Math.min(Math.max(now.getTime() - periodStart.getTime(), 0), total);
  if (total <= 0 || done < 86_400_000) return null; // too early in the month to guess
  return (used / done) * total;
}
