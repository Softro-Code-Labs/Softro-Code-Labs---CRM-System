import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fullName, toDateInput } from "@/lib/utils";
import { toCsv } from "@/lib/reports";
import { PAYMENT_METHOD_LABELS } from "@/lib/crm-meta";
import { getOrgSettings } from "@/lib/queries/org";
import { resolveFinancePeriod } from "@/lib/finance-math";
import { financeScope, incomeSummary } from "@/lib/finance";
import { renderIncomePdf } from "@/lib/pdf/income-pdf";

export const runtime = "nodejs";

const n = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v.toString()));
const money = (v: number | null) => (v == null ? "" : v.toFixed(2));

/**
 * GET /finance/export?format=csv|pdf&period=…|from=…&to=…&person=…
 * For the accountant: every payment received and commission earned in the period, in rupees.
 * CSV for spreadsheets (income +, commission −); PDF as a signable report. Scope as on the Income page:
 * Managers theirs and their team's, Admins everything (Sales can't export).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "finance:export")) return new NextResponse("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const period = resolveFinancePeriod({ period: sp.get("period") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const personParam = sp.get("person");
  const scope = await financeScope(user, personParam);
  if (personParam && !scope.person) return new NextResponse("Forbidden", { status: 403 });
  const sum = await incomeSummary(period, scope);
  const base = `softro-income-${toDateInput(period.from)}-to-${toDateInput(new Date(period.to.getTime() - 86_400_000))}${scope.person ? `-${scope.person.name.replace(/[^\w]+/g, "-").toLowerCase()}` : ""}`;
  const meta = { type: "finance", from: period.from.toISOString(), to: period.to.toISOString(), person: scope.person?.id ?? null };

  if (sp.get("format") === "pdf") {
    const org = await getOrgSettings();
    const pdf = await renderIncomePdf({ sum, org, period: period.label, scope: scope.label, preparedBy: user.name });
    await audit({ actorId: user.id, action: "export", entity: "Report", summary: `Exported the income report as PDF (${period.label}, ${scope.label})`, meta: { ...meta, format: "pdf" } });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${base}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }

  type Row = [string, string, string, string, string, string, string, string, string, string, string, string];
  const rows: Row[] = [];
  for (const { p, split } of sum.lines) {
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
    for (const c of p.commissions) {
      rows.push([
        toDateInput(p.paidAt),
        "Commission",
        c.role === "SELLER" ? "Sales commission" : "Manager's commission",
        `${p.receiptNumber} / ${p.invoice.number}`,
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
  }

  const csv = toCsv(["Date", "Type", "Category", "Reference", "Client or person", "Description", "Method", "Currency", "Amount (original)", "LKR (without VAT; commission negative)", "VAT LKR", "Notes"], rows);
  await audit({ actorId: user.id, action: "export", entity: "Report", summary: `Exported income and commission as CSV (${period.label}, ${scope.label})`, meta: { ...meta, format: "csv" } });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "private, no-store" } });
}
