import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const runtime = "nodejs";

/** The bill or receipt uploaded for an expense. Same people as the Expenses page. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "expense:manage")) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const expense = await db.expense.findUnique({ where: { id }, select: { receiptName: true, receiptType: true, receipt: { select: { data: true } } } });
  if (!expense?.receipt) return new NextResponse("Not found", { status: 404 });
  const type = expense.receiptType === "application/pdf" ? "application/pdf" : "image/jpeg";
  return new NextResponse(Buffer.from(expense.receipt.data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${(expense.receiptName ?? "receipt").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
