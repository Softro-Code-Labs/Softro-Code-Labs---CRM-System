import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health: for uptime monitors (UptimeRobot, Better Stack…).
 * 200 when the app and database are working, 503 when the database can't be reached.
 * Reveals nothing sensitive.
 */
export async function GET() {
  const started = Date.now();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, version, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable", version, time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
