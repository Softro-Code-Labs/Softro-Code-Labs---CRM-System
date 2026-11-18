import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getQuote } from "@/lib/quotes";
import { getOrgSettings } from "@/lib/queries/org";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";

export const runtime = "nodejs";

/** GET /quotes/:id/pdf  (add ?download=1 to save instead of open) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "quote:view")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const [quote, org] = await Promise.all([getQuote(id), getOrgSettings()]);
  if (!quote) return new NextResponse("Quote not found", { status: 404 });

  const pdf = await renderQuotePdf(quote, org);
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
