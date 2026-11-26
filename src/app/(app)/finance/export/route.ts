import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
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
 * GET /finance/export?format=csv|pdf&seal=1&period=…|from=…&to=…&person=…
 * For the accountant: every payment received and commission earned in the period, in rupees.
 * CSV for spreadsheets (income +, commission −); PDF as a report, optionally with the company seal and
 * the signer's signature (Admins and Managers with a signature). Scope as on the Income page:
 * Sales their own, Managers theirs and their team's, Admins everything.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "finance:view")) return new NextResponse("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const period = resolveFinancePeriod({ period: sp.get("period") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const personParam = sp.get("person");
  const scope = await financeScope(user, personParam);
  if (personParam && !scope.person) return new NextResponse("Forbidden", { status: 403 });
  const sum = await incomeSummary(period, scope);
  const base = `softro-income-${toDateInput(period.from)}-to-${toDateInput(new Date(period.to.getTime() - 86_400_000))}${scope.person ? `-${scope.person.name.replace(/[^\w]+/g, "-").toLowerCase()}` : ""}`;
  const meta = { type: "finance", from: period.from.toISOString(), to: period.to.toISOString(), person: scope.person?.id ?? null };

  if (sp.get("format") === "pdf") {
    let seal = null;
    if (sp.get("seal")) {
      if (!can(user.role, "document:seal")) return new NextResponse("Only Admins and Managers can seal documents.", { status: 403 });
      const [signature, me] = await Promise.all([
        db.userSignature.findUnique({ where: { userId: user.id }, select: { data: true } }),
        db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, jobTitle: true } }),
      ]);
      if (!signature) return new NextResponse("Add your signature under My profile first. It's printed next to the seal.", { status: 400 });
      seal = { signerName: me.name, signerTitle: me.jobTitle, signature: signature.data, sealedAt: new Date() };
    }
    const org = await getOrgSettings();
    const pdf = await renderIncomePdf({ sum, org, period: period.label, scope: scope.label, seal, preparedBy: user.name });
    await audit({ actorId: user.id, action: "export", entity: "Report", summary: `Exported the income report as PDF${seal ? ", sealed" : ""} (${period.label}, ${scope.label})`, meta: { ...meta, format: "pdf", sealed: Boolean(seal) } });
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${base}${seal ? "-sealed" : ""}.pdf"`, "Cache-Control": "private, no-store" },
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
