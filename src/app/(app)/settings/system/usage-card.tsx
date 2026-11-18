import { ExternalLink } from "lucide-react";
import type { Usage } from "@/lib/usage";
import { formatBytes } from "@/lib/usage-math";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TABLE_LABELS: Record<string, string> = {
  UserAvatar: "Profile photos",
  AuditLog: "Audit log",
  Activity: "Activities and tasks",
  Note: "Notes",
  ErrorEvent: "Error log",
  Lead: "Leads",
  Deal: "Deals",
  Company: "Companies",
  Contact: "Contacts",
  Quote: "Quotes",
  QuoteItem: "Quote lines",
  Invoice: "Invoices",
  InvoiceItem: "Invoice lines",
  Payment: "Payments",
  Ticket: "Tickets",
  TicketComment: "Ticket replies",
  Contract: "Contracts",
  Handover: "Handovers",
  ProjectAccess: "Project access",
  ProjectService: "Project services",
  User: "Team members",
  RateLimit: "Sign-in limits",
};

const LEVEL = {
  ok: { bar: "bg-emerald-500", badge: "green", text: "OK" },
  warn: { bar: "bg-amber-500", badge: "amber", text: "Over 80%" },
  full: { bar: "bg-red-500", badge: "red", text: "Nearly full" },
  unknown: { bar: "bg-ink-300", badge: "gray", text: "Unknown" },
} as const;

export function UsageCard({ usage }: { usage: Usage }) {
  const biggest = usage.tables[0]?.bytes || 1;
  return (
    <Card>
      <CardHeader title="Plan usage" description="How close we are to the free-plan limits. Admins get an email at 80%." />
      <CardBody className="space-y-5">
        {usage.meters.map((m) => {
          const l = LEVEL[m.level];
          return (
            <div key={m.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-ink-900">{m.label}</p>
                <p className="flex items-center gap-2 text-sm text-ink-700 tabular-nums">
                  {m.display}
                  {m.percent != null && <span className="text-ink-500">({m.percent}%)</span>}
                  <Badge tone={l.badge}>{l.text}</Badge>
                </p>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100"
                role="meter"
                aria-label={m.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={m.percent ?? 0}
              >
                <div className={cn("h-full rounded-full", l.bar)} style={{ width: `${Math.max(m.percent ?? 0, m.percent ? 1.5 : 0)}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {m.note}
                {m.forecast && <span className={cn("block", m.forecastOver && "font-medium text-amber-700")}>{m.forecast}</span>}
              </p>
            </div>
          );
        })}

        {!usage.neon.configured && (
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            To see compute hours and data transfer too, add <code className="font-mono">NEON_API_KEY</code> (a project-scoped key for this project) and{" "}
            <code className="font-mono">NEON_PROJECT_ID</code> in Vercel. See the README.
          </p>
        )}
        {usage.neon.configured && !usage.neon.ok && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Neon usage unavailable: {usage.neon.error}</p>}

        <div className="rounded-lg border border-ink-100 px-3 py-2.5 text-xs text-ink-600">
          <p className="font-medium text-ink-800">Vercel (hosting)</p>
          <p className="mt-0.5">
            Vercel doesn&apos;t share usage with apps on the free plan. Check bandwidth and function use on Vercel&apos;s usage page. Note: Vercel&apos;s free Hobby plan is for
            non-commercial use only; a company CRM needs the Pro plan.
          </p>
          <a href="https://vercel.com/dashboard/usage" target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
            Open Vercel usage <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </CardBody>

      {usage.tables.length > 0 && (
        <>
          <CardHeader title="What takes the space" description="The largest parts of the database." />
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {usage.tables.map((t) => (
              <li key={t.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-2 text-sm sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                <span className="truncate text-ink-800">{TABLE_LABELS[t.name] ?? t.name}</span>
                <span className="hidden h-1.5 overflow-hidden rounded-full bg-ink-100 sm:block">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max((t.bytes / biggest) * 100, 2)}%` }} />
                </span>
                <span className="text-right text-xs whitespace-nowrap text-ink-500 tabular-nums">
                  {formatBytes(t.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
