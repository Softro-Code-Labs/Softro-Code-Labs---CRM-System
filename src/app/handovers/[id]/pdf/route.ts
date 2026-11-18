import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getOrgSettings } from "@/lib/queries/org";
import { renderHandoverPdf } from "@/lib/pdf/handover-pdf";
import type { HandoverSnapshot } from "@/lib/project-access";

export const runtime = "nodejs";

/** GET /handovers/:id/pdf: a handover document exactly as it was issued (add ?download=1 to save). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "access:view")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const [handover, org] = await Promise.all([db.handover.findUnique({ where: { id } }), getOrgSettings()]);
  if (!handover) return new NextResponse("Not found", { status: 404 });
  const snapshot = handover.snapshot as unknown as HandoverSnapshot;

  const pdf = await renderHandoverPdf(snapshot, org);
  const filename = `${snapshot.number} Handover ${snapshot.project.client ?? snapshot.project.title}`.replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim() + ".pdf";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${request.nextUrl.searchParams.get("download") ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
