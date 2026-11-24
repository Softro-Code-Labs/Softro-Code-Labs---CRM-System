import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getVisibility } from "@/lib/visibility";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fullName, toDateInput } from "@/lib/utils";
import {
  DEAL_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  TICKET_CHANNEL_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/crm-meta";
import { resolvePeriod, teamReport, toCsv } from "@/lib/reports";

export const runtime = "nodejs";

const TYPES = ["deals", "leads", "tickets", "team", "quotes"] as const;
type ExportType = (typeof TYPES)[number];

/** Colombo date and time as "yyyy-mm-dd hh:mm", which Excel and Google Sheets read as a date. */
function stamp(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
}
const money = (v: { toString(): string } | null | undefined) => (v == null ? "" : Number(v.toString()).toFixed(2));

/** GET /reports/export?type=deals|leads|tickets|team&period=…|from=…&to=…&owner=… */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user.role, "report:export")) return new NextResponse("Forbidden", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") as ExportType;
  if (!TYPES.includes(type)) return new NextResponse("Unknown export type", { status: 400 });
  const period = resolvePeriod({ period: sp.get("period") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  // Same scope as the Reports page: Sales export their own records, Managers their team's, Admins everything.
  const v = await getVisibility(user);
  const requestedOwner = sp.get("owner") || undefined;
  const ownerId = requestedOwner && (v.ids === null || v.ids.includes(requestedOwner)) ? requestedOwner : undefined;
  if (requestedOwner && !ownerId) return new NextResponse("Forbidden", { status: 403 });
  const people = v.ids;
  const inPeriod = { gte: period.from, lt: period.to };

  let csv: string;
  let rows = 0;
  if (type === "deals") {
    const deals = await db.deal.findMany({
      where: { AND: [v.deal, { OR: [{ createdAt: inPeriod }, { closedAt: inPeriod }] }], ...(ownerId && { ownerId }) },
      orderBy: { createdAt: "asc" },
      include: {
        stage: { select: { name: true, probability: true } },
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        owner: { select: { name: true } },
        lead: { select: { source: true } },
      },
    });
    rows = deals.length;
    csv = toCsv(
      ["Deal", "Company", "Contact", "Service", "Status", "Stage", "Probability %", "Value", "Currency", "Owner", "Lead source", "Created", "Expected close", "Closed", "Lost reason"],
      deals.map((d) => [
        d.title, d.company?.name, d.contact ? fullName(d.contact) : "", d.serviceType ? SERVICE_TYPE_LABELS[d.serviceType] : "",
        DEAL_STATUS_LABELS[d.status], d.stage.name, d.stage.probability, money(d.value), d.currency, d.owner?.name,
        d.lead ? LEAD_SOURCE_LABELS[d.lead.source] : "", stamp(d.createdAt), toDateInput(d.expectedCloseDate), stamp(d.closedAt), d.lostReason,
      ]),
    );
  } else if (type === "leads") {
    const leads = await db.lead.findMany({
      where: { AND: [v.lead], createdAt: inPeriod, ...(ownerId && { ownerId }) },
      orderBy: { createdAt: "asc" },
      include: { owner: { select: { name: true } }, convertedDeal: { select: { status: true } } },
    });
    rows = leads.length;
    csv = toCsv(
      ["Lead", "Contact", "Company", "Email", "Phone", "Source", "Service", "Status", "Estimated value", "Currency", "Owner", "Received", "Reply due", "Replied", "Replied on time", "Deal outcome", "Unqualified reason"],
      leads.map((l) => [
        l.title, l.contactName, l.companyName, l.email, l.phone ?? l.whatsapp, LEAD_SOURCE_LABELS[l.source], l.serviceType ? SERVICE_TYPE_LABELS[l.serviceType] : "",
        LEAD_STATUS_LABELS[l.status], money(l.estimatedValue), l.currency, l.owner?.name, stamp(l.createdAt), stamp(l.respondBy), stamp(l.respondedAt),
        l.respondedAt ? (!l.respondBy || l.respondedAt <= l.respondBy ? "Yes" : "No") : "", l.convertedDeal ? DEAL_STATUS_LABELS[l.convertedDeal.status] : "", l.disqualifyReason,
      ]),
    );
  } else if (type === "tickets") {
    const tickets = await db.ticket.findMany({
      where: { createdAt: inPeriod, ...(ownerId ? { assignedToId: ownerId } : people && { assignedToId: { in: people } }) },
      orderBy: { createdAt: "asc" },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        contract: { select: { number: true } },
        assignedTo: { select: { name: true } },
      },
    });
    rows = tickets.length;
    csv = toCsv(
      ["Ticket", "Subject", "Company", "Contact", "Contract", "Priority", "Channel", "Status", "Assigned to", "Opened", "First reply due", "First replied", "Replied on time", "Hours to first reply", "Resolved"],
      tickets.map((t) => [
        t.number, t.subject, t.company?.name, t.contact ? fullName(t.contact) : "", t.contract?.number, TICKET_PRIORITY_LABELS[t.priority], TICKET_CHANNEL_LABELS[t.channel],
        TICKET_STATUS_LABELS[t.status], t.assignedTo?.name, stamp(t.createdAt), stamp(t.responseDueAt), stamp(t.firstResponseAt),
        t.firstResponseAt && t.responseDueAt ? (t.firstResponseAt <= t.responseDueAt ? "Yes" : "No") : "",
        t.firstResponseAt ? ((t.firstResponseAt.getTime() - t.createdAt.getTime()) / 3_600_000).toFixed(1) : "", stamp(t.resolvedAt),
      ]),
    );
  } else if (type === "quotes") {
    // Accounting: one row per quote line, accepted quotes only, with quote totals repeated on each line.
    const quotes = await db.quote.findMany({
      where: { AND: [v.quote], status: "ACCEPTED", acceptedAt: inPeriod, ...(ownerId && { createdById: ownerId }) },
      orderBy: [{ acceptedAt: "asc" }, { number: "asc" }],
      include: {
        company: { select: { name: true, email: true, addressLine: true } },
        contact: { select: { firstName: true, lastName: true, email: true } },
        deal: { select: { title: true } },
        items: { orderBy: { position: "asc" } },
      },
    });
    rows = quotes.length;
    csv = toCsv(
      ["Quote number", "Issue date", "Accepted date", "Customer", "Customer contact", "Customer email", "Customer address", "Quote title", "Line", "Item", "Description", "Quantity", "Unit", "Unit price", "Line discount %", "Line total", "Quote discount %", "Tax", "Tax rate %", "Subtotal", "Discount", "Tax amount", "Total", "Currency", "Deal"],
      quotes.flatMap((q) =>
        (q.items.length ? q.items : [null]).map((i, n) => [
          q.number, toDateInput(q.issueDate), stamp(q.acceptedAt).slice(0, 10), q.company?.name ?? (q.contact ? fullName(q.contact) : ""), q.contact ? fullName(q.contact) : "",
          q.contact?.email ?? q.company?.email, q.company?.addressLine, q.title, i ? n + 1 : "", i?.title, i?.description, i ? money(i.quantity) : "", i?.unit, i ? money(i.unitPrice) : "",
          i ? money(i.discountPercent) : "", i ? money(i.lineTotal) : "", money(q.discountPercent), q.taxLabel, money(q.taxRate), money(q.subtotal), money(q.discountTotal), money(q.taxTotal), money(q.total), q.currency, q.deal?.title,
        ]),
      ),
    );
  } else {
    const team = await teamReport({ period, people });
    rows = team.length;
    csv = toCsv(
      ["Person", "Role", "Leads", "Leads replied on time %", "Deals won", "Deals lost", "Win rate %", `Won value (${process.env.DEFAULT_CURRENCY ?? "LKR"})`, "Open pipeline", "Tasks done", "Tickets resolved", "Tickets replied on time %"],
      team.map((r) => [r.name, r.role, r.leads, r.replyOnTimeRate, r.won, r.lost, r.winRate, r.wonValue.toFixed(2), r.openPipeline.toFixed(2), r.activitiesDone, r.ticketsResolved, r.ticketSlaRate]),
    );
  }

  await audit({ actorId: user.id, action: "export", entity: "Report", summary: `Exported ${rows} ${type} (${period.label})`, meta: { type, from: period.from.toISOString(), to: period.to.toISOString(), ownerId: ownerId ?? null } });

  const filename = `softro-crm-${type}-${toDateInput(period.from)}-to-${toDateInput(new Date(period.to.getTime() - 86_400_000))}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
