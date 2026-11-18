import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { firstParam, formatMoneyTotals, toDateInput } from "@/lib/utils";
import { getAssignableUsers } from "@/lib/queries/users";
import { LEAD_SOURCE_LABELS, SERVICE_TYPE_LABELS, TICKET_PRIORITY_LABELS } from "@/lib/crm-meta";
import { forecastReport, leadReport, MAIN_CURRENCY, resolvePeriod, salesReport, supportReport, teamReport } from "@/lib/reports";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterSelect } from "@/components/ui/filter-select";
import { BarList, ColumnChart, compactMoney, ForecastChart, fullMoney, StatTile } from "@/components/reports/charts";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ExportMenu } from "@/components/reports/export-menu";
import type { LeadSource, ServiceType } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Reports" };

const pctText = (v: number | null) => (v == null ? "—" : `${v}%`);
function hoursText(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description && <p className="text-sm text-ink-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("report:view");
  const sp = await searchParams;
  const period = resolvePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) });
  const users = await getAssignableUsers();
  const ownerParam = firstParam(sp.owner);
  const owner = users.find((u) => u.id === ownerParam);
  const filters = { period, ownerId: owner?.id };
  const C = MAIN_CURRENCY;

  const [sales, forecast, leads, team, support] = await Promise.all([
    salesReport(filters),
    forecastReport(filters),
    leadReport(filters),
    teamReport(filters),
    supportReport(filters),
  ]);

  const qs = new URLSearchParams();
  for (const k of ["period", "from", "to", "owner"]) {
    const v = firstParam(sp[k]);
    if (v) qs.set(k, v);
  }
  const exportHref = (type: string) => `/reports/export?${new URLSearchParams([...qs.entries(), ["type", type]]).toString()}`;
  const lastDay = new Date(period.to.getTime() - 86_400_000);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Reports"
        description={`${period.label}${owner ? ` · ${owner.name}` : " · Whole team"}. Money charts are in ${C}.`}
        actions={
          can(user.role, "report:export") && (
            <ExportMenu
              items={[
                { href: exportHref("deals"), label: "Deals", hint: "Created or closed in the period" },
                { href: exportHref("leads"), label: "Leads", hint: "Received in the period" },
                { href: exportHref("tickets"), label: "Support tickets", hint: "Opened in the period" },
                { href: exportHref("team"), label: "Team performance", hint: "The team table below" },
                { href: exportHref("quotes"), label: "Accepted quotes", hint: "Line by line, with VAT, for accounts" },
              ]}
            />
          )
        }
      />

      <div className="-mt-6 flex flex-wrap items-center gap-2">
        <PeriodPicker from={toDateInput(period.from)} to={toDateInput(lastDay)} />
        <FilterSelect param="owner" label="Whole team" options={users.map((u) => ({ value: u.id, label: u.name }))} />
      </div>

      <Section title="Sales" description="Deals won or lost in the period.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Won revenue" value={formatMoneyTotals(sales.wonTotals)} hint={`${sales.wonCount} ${sales.wonCount === 1 ? "deal" : "deals"} won`} />
          <StatTile label="Win rate" value={pctText(sales.winRate)} hint={`${sales.wonCount} won · ${sales.lostCount} lost`} />
          <StatTile label="Average deal" value={sales.avgDeal == null ? "—" : compactMoney(sales.avgDeal, C)} hint={sales.avgDeal == null ? "No wins yet" : fullMoney(sales.avgDeal, C)} />
          <StatTile label="Time to win" value={sales.avgCycleDays == null ? "—" : `${sales.avgCycleDays} days`} hint="Average, from deal created to won" />
        </div>
        <Card>
          <CardHeader title="Won revenue by month" description={sales.otherCurrencyWon.length ? `Also won in other currencies: ${formatMoneyTotals(sales.otherCurrencyWon)}` : `Value of deals won, by the month they were won (${C}).`} />
          <div className="px-5 pt-6 pb-4">
            <ColumnChart data={sales.months} currency={C} caption={`Won revenue by month, ${period.label}`} />
          </div>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="By service" />
            <BarList
              empty="No won deals in this period."
              rows={sales.byService.map((r) => ({ key: r.service, label: r.service === "NONE" ? "Not set" : SERVICE_TYPE_LABELS[r.service as ServiceType], value: r.value, display: compactMoney(r.value, C) }))}
            />
          </Card>
          <Card>
            <CardHeader title="Top clients" />
            <BarList
              empty="No won deals in this period."
              rows={sales.byClient.map((r) => ({
                key: r.id ?? "none",
                label: r.id ? <Link href={`/companies/${r.id}`} className="hover:text-brand-700">{r.name}</Link> : r.name,
                value: r.value,
                display: compactMoney(r.value, C),
              }))}
            />
          </Card>
          <Card>
            <CardHeader title="Why we lost" description="Reasons recorded when deals were marked lost." />
            <BarList empty="No lost deals in this period." rows={sales.lostReasons.map((r) => ({ key: r.label, label: r.label, value: r.count, display: String(r.count) }))} />
          </Card>
        </div>
      </Section>

      <Section title="Pipeline forecast" description={`Open deals in ${C}, by expected close date. Always from today, whatever period is selected.`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open pipeline" value={compactMoney(forecast.total, C)} hint={`${forecast.count} open ${forecast.count === 1 ? "deal" : "deals"}`} />
          <StatTile label="Weighted forecast" value={compactMoney(forecast.weighted, C)} hint="Value × stage win probability" />
          <StatTile label="Close date passed" value={forecast.late.count} tone={forecast.late.count ? "bad" : undefined} hint={forecast.late.count ? `${compactMoney(forecast.late.total, C)} · update these deals` : "All close dates are current"} />
          <StatTile label="No close date" value={forecast.undated.count} hint={forecast.undated.count ? compactMoney(forecast.undated.total, C) : "Every deal has a date"} />
        </div>
        <Card className="px-5 pt-5 pb-4">
          <ForecastChart data={forecast.months} currency={C} />
          {forecast.later.count > 0 && (
            <p className="mt-2 text-xs text-ink-500">
              Plus {forecast.later.count} {forecast.later.count === 1 ? "deal" : "deals"} expected later ({compactMoney(forecast.later.total, C)}).
            </p>
          )}
        </Card>
      </Section>

      <Section title="Leads" description="Enquiries received in the period.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="New leads" value={leads.total} hint={`${leads.unqualified} unqualified`} />
          <StatTile label="Became deals" value={pctText(leads.conversionRate)} hint={`${leads.converted} converted`} />
          <StatTile label="Replied within 2 working days" value={pctText(leads.replyOnTimeRate)} tone={leads.replyOnTimeRate != null && leads.replyOnTimeRate < 80 ? "bad" : undefined} hint={leads.notReplied ? `${leads.notReplied} still waiting` : "None waiting"} />
          <StatTile label="Typical first reply" value={hoursText(leads.medianReplyHours)} hint="Median time to reply" />
        </div>
        <Card>
          <CardHeader title="Where leads come from" description="Which channels bring work that we win." />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Leads</th>
                  <th className="px-5 py-3 text-right">Became deals</th>
                  <th className="px-5 py-3 text-right">Conversion</th>
                  <th className="px-5 py-3 text-right">Won</th>
                  <th className="px-5 py-3 text-right">Won value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular-nums">
                {leads.bySource.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-ink-500">No leads in this period.</td>
                  </tr>
                )}
                {leads.bySource.map((r) => (
                  <tr key={r.source}>
                    <td className="px-5 py-3 font-medium text-ink-900">{LEAD_SOURCE_LABELS[r.source as LeadSource]}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.leads}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.converted}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{pctText(r.conversionRate)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.won}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.wonValue ? fullMoney(r.wonValue, C) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section title="Team" description="What each person did in the period. Open pipeline is as of today.">
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Person</th>
                  <th className="px-5 py-3 text-right">Leads</th>
                  <th className="px-5 py-3 text-right">Replied on time</th>
                  <th className="px-5 py-3 text-right">Won / lost</th>
                  <th className="px-5 py-3 text-right">Win rate</th>
                  <th className="px-5 py-3 text-right">Won value</th>
                  <th className="px-5 py-3 text-right">Open pipeline</th>
                  <th className="px-5 py-3 text-right">Tasks done</th>
                  <th className="px-5 py-3 text-right">Tickets resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular-nums">
                {team.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-6 text-ink-500">No activity in this period.</td>
                  </tr>
                )}
                {team.map((r) => (
                  <tr key={r.id} className={owner?.id === r.id ? "bg-brand-50/50" : undefined}>
                    <td className="px-5 py-3">
                      <span className="font-medium whitespace-nowrap text-ink-900">{r.name}</span>
                      <span className="block text-xs text-ink-500">{ROLE_LABELS[r.role]}</span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.leads || "—"}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{pctText(r.replyOnTimeRate)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.won || r.lost ? `${r.won} / ${r.lost}` : "—"}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{pctText(r.winRate)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.wonValue ? compactMoney(r.wonValue, C) : "—"}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.openPipeline ? compactMoney(r.openPipeline, C) : "—"}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.activitiesDone || "—"}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {r.ticketsResolved || "—"}
                      {r.ticketSlaRate != null && <span className="block text-xs text-ink-500">{r.ticketSlaRate}% replied on time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      <Section title="Support and contracts" description="Tickets opened in the period; contracts as of today.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Tickets opened" value={support.opened} hint={`${support.resolved} resolved · ${support.openNow} open now`} />
          <StatTile label="First reply on time" value={pctText(support.slaRate)} tone={support.slaRate != null && support.slaRate < 80 ? "bad" : undefined} hint={`Typical first reply: ${hoursText(support.medianReplyHours)}`} />
          <StatTile label="Monthly recurring value" value={support.mrr.length ? formatMoneyTotals(support.mrr) : "—"} hint={`${support.activeContracts} active ${support.activeContracts === 1 ? "contract" : "contracts"}`} />
          <StatTile label="Renewals in next 90 days" value={support.renewals90} hint={<Link href="/contracts?tab=renew" className="text-brand-700 hover:underline">See renewals</Link>} />
        </div>
        <Card>
          <CardHeader title="Tickets by priority" description={support.opened ? `${support.underContract} of ${support.opened} were under a contract.` : undefined} />
          <BarList
            empty="No tickets opened in this period."
            rows={support.opened ? support.byPriority.map((r) => ({ key: r.priority, label: TICKET_PRIORITY_LABELS[r.priority], value: r.count, display: String(r.count) })) : []}
          />
        </Card>
      </Section>
    </div>
  );
}
