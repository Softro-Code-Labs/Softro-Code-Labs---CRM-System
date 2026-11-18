"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Building2, CalendarClock, GripVertical } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { SERVICE_TYPE_SHORT } from "@/lib/crm-meta";
import type { ServiceType } from "@/generated/prisma/enums";
import { moveDealStage } from "./actions";

export type BoardStage = { id: string; name: string; probability: number };
export type BoardDeal = {
  id: string;
  title: string;
  value: string;
  currency: string;
  stageId: string;
  serviceType: ServiceType | null;
  companyName: string | null;
  ownerName: string | null;
  daysInStage: number;
  closeDate: string | null; // already formatted
  closeOverdue: boolean;
};

function totals(deals: BoardDeal[]) {
  const map = new Map<string, number>();
  for (const d of deals) map.set(d.currency, (map.get(d.currency) ?? 0) + Number(d.value));
  return [...map.entries()].map(([currency, value]) => formatMoney(value, currency)).join(" + ") || "—";
}

export function DealBoard({ stages, deals, canMove }: { stages: BoardStage[]; deals: BoardDeal[]; canMove: boolean }) {
  const [optimisticDeals, moveOptimistic] = useOptimistic(deals, (current, move: { id: string; stageId: string }) =>
    current.map((d) => (d.id === move.id ? { ...d, stageId: move.stageId, daysInStage: 0 } : d)),
  );
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(id: string, stageId: string) {
    const deal = optimisticDeals.find((d) => d.id === id);
    if (!deal || deal.stageId === stageId) return;
    setError(null);
    startTransition(async () => {
      moveOptimistic({ id, stageId });
      const result = await moveDealStage(id, stageId);
      if (result?.message) setError(result.message);
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const columnDeals = optimisticDeals.filter((d) => d.stageId === stage.id);
          return (
            <section
              key={stage.id}
              aria-label={stage.name}
              onDragOver={(e) => {
                if (!canMove) return;
                e.preventDefault();
                setDragOver(stage.id);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/deal-id");
                if (id) move(id, stage.id);
              }}
              className={cn(
                "flex w-80 shrink-0 flex-col rounded-xl border bg-ink-100/70 transition-colors",
                dragOver === stage.id ? "border-brand-400 bg-brand-50" : "border-ink-200",
              )}
            >
              <header className="border-b border-ink-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink-900">{stage.name}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-ink-600">{columnDeals.length}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {totals(columnDeals)} · {stage.probability}% likely
                </p>
              </header>
              <ul className="flex min-h-32 flex-1 flex-col gap-2 p-3">
                {columnDeals.map((deal) => (
                  <li
                    key={deal.id}
                    draggable={canMove}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/deal-id", deal.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn("group rounded-lg border border-ink-200 bg-white p-3 shadow-sm", canMove && "cursor-grab active:cursor-grabbing")}
                  >
                    <div className="flex items-start gap-2">
                      {canMove && <GripVertical className="mt-0.5 size-4 shrink-0 text-ink-300 group-hover:text-ink-400" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <Link href={`/deals/${deal.id}`} className="block text-sm font-medium text-ink-900 hover:text-brand-700">
                          {deal.title}
                        </Link>
                        {deal.companyName && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-500">
                            <Building2 className="size-3" aria-hidden /> {deal.companyName}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-ink-800 tabular-nums">{formatMoney(deal.value, deal.currency)}</span>
                          {deal.serviceType && (
                            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-700">{SERVICE_TYPE_SHORT[deal.serviceType]}</span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
                          <span>{deal.ownerName ?? "Unassigned"}</span>
                          <span title="Days in this stage">{deal.daysInStage}d in stage</span>
                        </div>
                        {deal.closeDate && (
                          <p className={cn("mt-1 flex items-center gap-1 text-[11px]", deal.closeOverdue ? "font-medium text-red-600" : "text-ink-500")}>
                            <CalendarClock className="size-3" aria-hidden /> Close {deal.closeDate}
                          </p>
                        )}
                        {canMove && (
                          <label className="mt-2 block sm:hidden">
                            <span className="sr-only">Move to stage</span>
                            <select
                              value={deal.stageId}
                              onChange={(e) => move(deal.id, e.target.value)}
                              className="w-full rounded border border-ink-200 bg-ink-50 px-2 py-1 text-xs"
                            >
                              {stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                {columnDeals.length === 0 && (
                  <li className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-ink-200 p-4 text-center text-xs text-ink-400">
                    {canMove ? "Drag deals here" : "No deals"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
