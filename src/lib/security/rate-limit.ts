import "server-only";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limiting stored in Postgres, so limits hold across all
 * serverless instances. One atomic upsert per check.
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)),
  };
}

/** Forget a key, e.g. after a successful sign-in. */
export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Removes expired counters. Called from the daily job. */
export async function pruneRateLimits() {
  const { count } = await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86_400_000) } } });
  return count;
}

export const LIMITS = {
  /** Wrong-password attempts from one network address, across all accounts. */
  loginPerIp: { limit: 20, windowSeconds: 15 * 60 },
  /** 2FA codes per person. */
  twoFactorPerUser: { limit: 6, windowSeconds: 10 * 60 },
  /** Profile photo uploads per person. */
  avatarUploadsPerUser: { limit: 10, windowSeconds: 10 * 60 },
  /** Website enquiries from one address. */
  websiteLeadPerIp: { limit: 10, windowSeconds: 10 * 60 },
} as const;
