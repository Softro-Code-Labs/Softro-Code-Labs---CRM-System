import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getOrgSettings } from "@/lib/queries/org";
import { receiptInclude, renderReceiptPdf } from "@/lib/pdf/receipt-pdf";

export const runtime = "nodejs";

/** GET /receipts/:paymentId/pdf  (add ?download=1 to save instead of open) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "invoice:view")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const [payment, org] = await Promise.all([db.payment.findUnique({ where: { id }, include: receiptInclude }), getOrgSettings()]);
  if (!payment) return new NextResponse("Receipt not found", { status: 404 });

  const pdf = await renderReceiptPdf(payment, org);
  const client = payment.invoice.company?.name ?? "";
  const filename = `${payment.receiptNumber} ${client}`.replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim() + ".pdf";
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
