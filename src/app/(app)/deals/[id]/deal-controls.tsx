"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markDealLost, markDealWon, moveDealStage, reopenDeal } from "../actions";
import type { DealStatus } from "@/generated/prisma/enums";

type Stage = { id: string; name: string };

export function StageBar({ dealId, stages, currentStageId, status, canEdit }: { dealId: string; stages: Stage[]; currentStageId: string; status: DealStatus; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const closed = status !== "OPEN";

  return (
    <div>
      <ol className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-medium sm:text-sm">
        {stages.map((stage, i) => {
          const done = closed ? status === "WON" : i < currentIndex;
          const current = !closed && i === currentIndex;
          return (
            <li key={stage.id} className="flex-1 border-r border-slate-200 last:border-r-0">
              <button
                type="button"
                disabled={!canEdit || closed || pending || current}
                onClick={() =>
                  startTransition(async () => {
                    const result = await moveDealStage(dealId, stage.id);
                    setError(result?.message ?? null);
                  })
                }
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 px-2 py-2.5 transition-colors",
                  current && "bg-brand-600 text-white",
                  done && "bg-brand-50 text-brand-700",
                  !current && !done && "text-slate-500",
                  canEdit && !closed && !current && "hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {done && <Check className="size-3.5" aria-hidden />}
                {stage.name}
              </button>
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CloseDealButtons({ dealId, status, canEdit }: { dealId: string; status: DealStatus; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [askReason, setAskReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canEdit) return null;

  const run = (fn: () => Promise<{ message?: string } | void>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result?.message ?? null);
      if (!result?.message) setAskReason(false);
    });

  if (status !== "OPEN") {
    return (
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => reopenDeal(dealId))}>
        <RotateCcw className="size-4" aria-hidden /> Reopen deal
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {!askReason ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => markDealWon(dealId))} className="bg-emerald-600 hover:bg-emerald-700">
            <Trophy className="size-4" aria-hidden /> Mark won
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAskReason(true)}>
            <XCircle className="size-4" aria-hidden /> Mark lost
          </Button>
        </div>
      ) : (
        <form className="flex flex-wrap items-center gap-2" action={(formData) => run(() => markDealLost(dealId, formData))}>
          <input
            name="lostReason"
            autoFocus
            required
            placeholder="Why did we lose it? e.g. went with a cheaper agency"
            aria-label="Reason the deal was lost"
            className="h-8 min-w-64 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
          <Button size="sm" variant="danger" type="submit" disabled={pending}>
            Mark lost
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setAskReason(false)}>
            Cancel
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
