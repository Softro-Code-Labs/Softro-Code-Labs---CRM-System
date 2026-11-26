import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fullName, toDateInput } from "@/lib/utils";
import { toCsv } from "@/lib/reports";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/crm-meta";
import { resolveFinancePeriod, splitPayment } from "@/lib/finance-math";
import { paymentsIn } from "@/lib/finance";

export const runtime = "nodejs";

const n = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const money = (v: number | null) => (v == null ? "" : v.toFixed(2));

/**
 * GET /finance/export?period=…|from=…&to=…
 * One CSV for the accountant: every payment received, expense paid and commission earned in the period,
 * as signed rupee amounts (income +, costs −) so a column total is the profit.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "finance:view")) return new NextResponse("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const period = resolveFinancePeriod({ period: sp.get("period") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const range = { gte: period.from, lt: period.to };

  const [payments, expenses, commissions] = await Promise.all([
    paymentsIn(period),
    db.expense.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    db.commission.findMany({
      where: { payment: { paidAt: range } },
      include: { user: { select: { name: true } }, payment: { select: { paidAt: true, receiptNumber: true, invoice: { select: { number: true } } } } },
    }),
  ]);

  type Row = [string, string, string, string, string, string, string, string, string, string, string, string];
  const rows: Row[] = [];
  for (const p of payments) {
    const split = splitPayment({ amount: n(p.amount), amountLkr: p.amountLkr == null ? null : n(p.amountLkr), currency: p.invoice.currency, invoiceTotal: n(p.invoice.total), invoiceTax: n(p.invoice.taxTotal) });
    const party = p.invoice.company?.name ?? (p.invoice.contact ? fullName(p.invoice.contact) : "");
    rows.push([
      toDateInput(p.paidAt),
      "Income",
      split?.foreign ? "Export of services (foreign currency)" : "Local sale",
      `${p.receiptNumber} / ${p.invoice.number}`,
      party,
      p.invoice.title,
      PAYMENT_METHOD_LABELS[p.method],
      p.invoice.currency,
      n(p.amount).toFixed(2),
      money(split ? split.net : null),
      money(split ? split.vat : null),
      split ? (p.reference ?? "") : "No rupee amount recorded",
    ]);
  }
  for (const e of expenses) {
    rows.push([toDateInput(e.date), "Expense", EXPENSE_CATEGORY_LABELS[e.category], e.reference ?? "", e.supplier ?? "", e.description, "", "LKR", n(e.amount).toFixed(2), money(-n(e.amount)), "", [e.notes, e.receiptName ? "Receipt in CRM" : "No receipt"].filter(Boolean).join(" · ")]);
  }
  for (const c of commissions) {
    rows.push([
      toDateInput(c.payment.paidAt),
      "Commission",
      c.role === "SELLER" ? "Sales commission" : "Manager's commission",
      `${c.payment.receiptNumber} / ${c.payment.invoice.number}`,
      c.user.name,
      `${n(c.percent)}% of ${n(c.base).toFixed(2)}`,
      "",
      "LKR",
      n(c.amount).toFixed(2),
      money(-n(c.amount)),
      "",
      c.paidAt ? `Paid ${toDateInput(c.paidAt)}` : "Not paid yet",
    ]);
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));

  const csv = toCsv(["Date", "Type", "Category", "Reference", "Client, supplier or person", "Description", "Method", "Currency", "Amount (original)", "LKR (without VAT; costs negative)", "VAT LKR", "Notes"], rows);
  await audit({ actorId: user.id, action: "export", entity: "Report", summary: `Exported income, expenses and commission (${period.label})`, meta: { type: "finance", from: period.from.toISOString(), to: period.to.toISOString() } });
  const filename = `softro-income-expenses-${toDateInput(period.from)}-to-${toDateInput(new Date(period.to.getTime() - 86_400_000))}.csv`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
