import { NextResponse } from "next/server";
import { calendarFeed } from "@/lib/integrations/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/calendar/<token>.ics: a person's private task calendar. The token is the only credential. */
export async function GET(_request: Request, { params }: { params: Promise<{ feed: string }> }) {
  const { feed } = await params;
  const body = await calendarFeed(feed.replace(/\.ics$/, ""));
  if (!body) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="softro-crm.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
