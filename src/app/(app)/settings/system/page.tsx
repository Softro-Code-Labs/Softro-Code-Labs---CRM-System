import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { envChecks } from "@/lib/env";
import { appUrl } from "@/lib/integrations/app-url";
import { colomboWhen } from "@/lib/integrations/notify";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResolveButton } from "./resolve-button";

export const metadata: Metadata = { title: "System health" };

async function databaseCheck() {
  const started = performance.now();
  try {
    const [rows, migration, size] = await Promise.all([
      db.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`,
      db.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`.catch(() => []),
      db.$queryRaw<{ size: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`.catch(() => []),
    ]);
    return { ok: rows.length === 1, ms: Math.round(performance.now() - started), migration: migration[0] ?? null, size: size[0]?.size ?? null };
  } catch {
    return { ok: false, ms: null, migration: null, size: null };
  }
}

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePermission("system:view");
  const { show } = await searchParams;
  const showFixed = show === "all";
  const [database, errors, openCount] = await Promise.all([
    databaseCheck(),
    db.errorEvent.findMany({ where: showFixed ? {} : { resolvedAt: null }, orderBy: { lastSeenAt: "desc" }, take: 50 }),
    db.errorEvent.count({ where: { resolvedAt: null } }),
  ]);
  const checks = envChecks();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="System health" description="Is everything working, and what went wrong recently." breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "System health" }]} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-500">Database</p>
          <p className={database.ok ? "mt-1 text-lg font-semibold text-emerald-700" : "mt-1 text-lg font-semibold text-red-600"}>{database.ok ? `OK · ${database.ms} ms` : "Unreachable"}</p>
          <p className="mt-1 text-xs text-ink-500">{database.size ? `${database.size} used` : ""}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-500">Open errors</p>
          <p className={openCount ? "mt-1 text-lg font-semibold text-red-600" : "mt-1 text-lg font-semibold text-emerald-700"}>{openCount ? `${openCount} to look at` : "None"}</p>
          <p className="mt-1 text-xs text-ink-500">Admins are alerted by chat or email.</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-500">Version</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink-900">{version ?? "local"}</p>
          <p className="mt-1 truncate text-xs text-ink-500" title={database.migration?.migration_name}>
            {database.migration ? `Database: ${database.migration.migration_name.replace(/^\d+_/, "")}` : "Migrations unknown"}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={showFixed ? "All recent errors" : "Errors to look at"}
          description="Server errors, grouped: the same error on any record is one row. Fixed errors come back here if they happen again."
          action={
            <a href={showFixed ? "/settings/system" : "/settings/system?show=all"} className="text-xs font-medium text-brand-700 hover:underline">
              {showFixed ? "Hide fixed" : "Show fixed too"}
            </a>
          }
        />
        {errors.length === 0 ? (
          <CardBody className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" aria-hidden /> No errors. All good.
          </CardBody>
        ) : (
          <ul className="divide-y divide-ink-100">
            {errors.map((e) => (
              <li key={e.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words text-ink-900">{e.message}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {e.method} {e.path ?? "unknown page"} · seen {e.count}× · last {colomboWhen(e.lastSeenAt)} · first {colomboWhen(e.firstSeenAt)}
                      {e.digest && <> · ref <span className="font-mono">{e.digest}</span></>}
                    </p>
                  </div>
                  {e.resolvedAt ? <Badge tone="green">Fixed {colomboWhen(e.resolvedAt)}</Badge> : <ResolveButton id={e.id} />}
                </div>
                {e.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-800">Technical details</summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-ink-950 p-3 text-[11px] leading-relaxed text-ink-200">{e.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Configuration" description="Settings from Vercel environment variables. Values are never shown." />
        <ul className="divide-y divide-ink-100">
          {checks.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span>
                <span className="font-mono text-xs text-ink-800">{c.name}</span>
                <span className="ml-2 text-xs text-ink-500">{c.hint}</span>
              </span>
              {c.ok ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" aria-hidden /> Set</span>
              ) : (
                <span className={c.required ? "flex items-center gap-1 text-xs font-medium text-red-600" : "flex items-center gap-1 text-xs font-medium text-amber-700"}>
                  <CircleAlert className="size-3.5" aria-hidden /> {c.required ? "Missing" : "Not set (optional)"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Uptime and backups" />
        <CardBody className="space-y-3 text-sm text-ink-600">
          <p>
            <strong className="text-ink-800">Uptime check:</strong> point a free monitor (UptimeRobot or Better Stack) at <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-xs text-ink-800">{appUrl("/api/health")}</code>. It returns 200 when the app and database are working.
          </p>
          <p>
            <strong className="text-ink-800">Backups:</strong> Neon keeps a restore history (point-in-time restore from its console). The GitHub “Database backup” workflow also saves an encrypted copy every night for 30 days. See <em>Backups and restore</em> in the README.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
