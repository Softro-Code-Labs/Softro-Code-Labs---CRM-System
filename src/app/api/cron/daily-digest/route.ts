import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDailyDigest } from "@/lib/integrations/digest";
import { emailConfigured } from "@/lib/integrations/email";
import { isColomboWeekend } from "@/lib/working-days";
import { pruneRateLimits } from "@/lib/security/rate-limit";
import { pruneErrors } from "@/lib/monitoring/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !header.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/**
 * Daily summary emails. Vercel Cron calls this at 02:30 UTC (8:00 am Sri Lanka) with
 * "Authorization: Bearer $CRON_SECRET" (see vercel.json). Weekends are skipped.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Housekeeping: drop old rate-limit counters and errors fixed more than 90 days ago.
  const pruned = { rateLimits: await pruneRateLimits(), errors: await pruneErrors() };
  if (!emailConfigured()) return NextResponse.json({ ok: true, pruned, skipped: "email is not set up" });
  const force = request.nextUrl.searchParams.get("force") === "1";
  if (isColomboWeekend() && !force) return NextResponse.json({ ok: true, pruned, skipped: "weekend" });
  const result = await runDailyDigest(new Date(), { force });
  return NextResponse.json({ ok: true, pruned, ...result });
}
