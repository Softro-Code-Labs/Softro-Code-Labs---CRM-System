import "server-only";
import { db } from "@/lib/db";
import { formatBytes, planLimit, projectedUse, usageLevel, usagePercent, type UsageLevel } from "@/lib/usage-math";

/**
 * Plan usage for admins: how close we are to the Neon free-plan limits.
 * Database size always works (asked from Postgres itself). Compute hours and data transfer
 * come from Neon's project API when NEON_API_KEY and NEON_PROJECT_ID are set.
 * Vercel has no usage API for the Hobby plan, so the panel links to its usage page instead.
 */

export type Meter = {
  key: string;
  label: string;
  used: number | null;
  limit: number;
  display: string; // "42 MB of 1 GB"
  percent: number | null;
  level: UsageLevel;
  note: string;
  forecast?: string;
  forecastOver?: boolean;
};

export type Usage = {
  meters: Meter[];
  tables: { name: string; bytes: number; rows: number }[];
  neon: { configured: boolean; ok: boolean; error?: string; periodEnd?: Date };
  checkedAt: Date;
};

const MB = 1024 * 1024;
const GB = 1024 * MB;

type NeonProject = {
  compute_time_seconds?: number;
  active_time_seconds?: number;
  data_transfer_bytes?: number;
  synthetic_storage_size?: number;
  consumption_period_start?: string;
  consumption_period_end?: string;
};

async function neonProject(): Promise<{ configured: boolean; ok: boolean; error?: string; project?: NeonProject }> {
  const key = process.env.NEON_API_KEY;
  const id = process.env.NEON_PROJECT_ID;
  if (!key || !id) return { configured: false, ok: false };
  try {
    const res = await fetch(`${process.env.NEON_API_BASE ?? "https://console.neon.tech/api/v2"}/projects/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 900 }, // at most every 15 minutes
    });
    if (!res.ok) return { configured: true, ok: false, error: res.status === 401 || res.status === 403 ? "Neon refused the API key." : res.status === 404 ? "Neon project not found. Check NEON_PROJECT_ID." : `Neon answered ${res.status}.` };
    const body = (await res.json()) as { project?: NeonProject };
    return { configured: true, ok: true, project: body.project ?? {} };
  } catch {
    return { configured: true, ok: false, error: "Couldn't reach Neon." };
  }
}

function meter(m: Omit<Meter, "percent" | "level">): Meter {
  return { ...m, percent: usagePercent(m.used, m.limit), level: usageLevel(m.used, m.limit) };
}

let cache: { at: number; value: Promise<Usage> } | null = null;

/** Cached for 10 minutes so the morning emails to several admins ask once. */
export function getUsage(): Promise<Usage> {
  if (cache && Date.now() - cache.at < 600_000) return cache.value;
  const value = loadUsage().catch((e) => {
    cache = null;
    throw e;
  });
  cache = { at: Date.now(), value };
  return value;
}

async function loadUsage(): Promise<Usage> {
  const now = new Date();
  const storageLimit = planLimit(process.env.PLAN_DB_STORAGE_MB, 1024) * MB;
  const computeLimit = planLimit(process.env.PLAN_COMPUTE_HOURS, 100);
  const transferLimit = planLimit(process.env.PLAN_TRANSFER_GB, 5) * GB;

  const [size, tables, neon] = await Promise.all([
    db.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`.catch(() => []),
    db.$queryRaw<{ name: string; bytes: bigint; rows: bigint }[]>`
      SELECT relname AS name, pg_total_relation_size(relid) AS bytes, n_live_tup AS rows
      FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(relid) DESC LIMIT 8`.catch(() => []),
    neonProject(),
  ]);

  const dbBytes = size[0] ? Number(size[0].bytes) : null;
  const meters: Meter[] = [
    meter({
      key: "storage",
      label: "Database storage",
      used: dbBytes,
      limit: storageLimit,
      display: `${formatBytes(dbBytes)} of ${formatBytes(storageLimit)}`,
      note: "Doesn't reset. When full, saving new records fails until we free space or upgrade Neon.",
    }),
  ];

  const p = neon.project;
  const start = p?.consumption_period_start ? new Date(p.consumption_period_start) : null;
  const end = p?.consumption_period_end ? new Date(p.consumption_period_end) : null;
  if (neon.ok && p) {
    // compute_time_seconds is CPU seconds; 1 CU is 1 vCPU, so this is about the CU-hours Neon counts.
    const hours = p.compute_time_seconds != null ? p.compute_time_seconds / 3600 : null;
    const forecast = hours != null && start && end ? projectedUse(hours, start, end, now) : null;
    meters.push(
      meter({
        key: "compute",
        label: "Database compute this month",
        used: hours,
        limit: computeLimit,
        display: hours == null ? "—" : `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} of ${computeLimit} CU-hours`,
        note: "Resets each month. The database sleeps when nobody is using it, which keeps this low.",
        forecastOver: forecast != null && forecast > computeLimit,
        forecast: forecast != null ? `On this pace, about ${Math.round(forecast)} CU-hours by ${end!.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Colombo" })}${forecast > computeLimit ? ", more than the plan allows" : ""}.` : undefined,
      }),
      meter({
        key: "transfer",
        label: "Data transfer this month",
        used: p.data_transfer_bytes ?? null,
        limit: transferLimit,
        display: `${formatBytes(p.data_transfer_bytes ?? null)} of ${formatBytes(transferLimit)}`,
        note: "Resets each month. Data sent from the database to the app and to backups.",
      }),
    );
  }

  return {
    meters,
    tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })),
    neon: { configured: neon.configured, ok: neon.ok, error: neon.error, periodEnd: end ?? undefined },
    checkedAt: now,
  };
}

/** Meters at 80% or more, for the admins' morning email. */
export async function usageWarnings() {
  try {
    return (await getUsage()).meters.filter((m) => m.level === "warn" || m.level === "full");
  } catch {
    return [];
  }
}
