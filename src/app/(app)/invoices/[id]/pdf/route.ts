import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getInvoice } from "@/lib/invoices";
import { canSee } from "@/lib/visibility";
import { getOrgSettings } from "@/lib/queries/org";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";

/** GET /invoices/:id/pdf  (add ?download=1 to save instead of open) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "invoice:view")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const [quote, org] = await Promise.all([getInvoice(id), getOrgSettings()]);
  if (!quote || !(await canSee(user, "invoice", id))) return new NextResponse("Invoice not found", { status: 404 });

  const pdf = await renderInvoicePdf(quote, org);
  const client = quote.company?.name ?? "";
  const filename = `${quote.number} ${client || quote.title}`.replace(/[^\w\s.-]/g, "").replace(/\s+/g, " ").trim() + ".pdf";
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
