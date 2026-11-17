"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addStage, deleteStage, moveStage, updateStage } from "./actions";

type Stage = { id: string; name: string; probability: number; isWon: boolean; isLost: boolean; dealCount: number };

const input =
  "h-9 rounded-lg border border-ink-300 bg-white px-3 text-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none disabled:bg-ink-100";

export function PipelineEditor({ pipelineId, stages }: { pipelineId: string; stages: Stage[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const openStages = stages.filter((s) => !s.isWon && !s.isLost);

  const run = (fn: () => Promise<{ message?: string }>, okMessage?: string) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.message ?? null);
      setSaved(result.message ? null : (okMessage ?? null));
    });

  return (
    <div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}

      <ol className="divide-y divide-ink-100">
        {stages.map((stage) => {
          const closed = stage.isWon || stage.isLost;
          const openIndex = openStages.findIndex((s) => s.id === stage.id);
          return (
            <li key={stage.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", closed && "bg-ink-50/60")}>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${stage.name} up`}
                  disabled={closed || pending || openIndex <= 0}
                  onClick={() => run(() => moveStage(stage.id, "up"))}
                  className="rounded p-0.5 text-ink-400 hover:text-ink-900 disabled:opacity-25"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${stage.name} down`}
                  disabled={closed || pending || openIndex === openStages.length - 1}
                  onClick={() => run(() => moveStage(stage.id, "down"))}
                  className="rounded p-0.5 text-ink-400 hover:text-ink-900 disabled:opacity-25"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>
              <form
                className="flex flex-1 flex-wrap items-center gap-2"
                action={(formData) => run(() => updateStage(stage.id, formData), `Saved "${formData.get("name")}".`)}
              >
                <input name="name" defaultValue={stage.name} aria-label="Stage name" className={cn(input, "min-w-48 flex-1")} required maxLength={60} />
                <label className="flex items-center gap-1.5 text-sm text-ink-600">
                  <input
                    name="probability"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={stage.probability}
                    disabled={closed}
                    aria-label={`Win probability for ${stage.name}`}
                    className={cn(input, "w-20")}
                  />
                  %
                </label>
                <Button size="sm" variant="secondary" type="submit" disabled={pending}>
                  Save
                </Button>
              </form>
              <span className="w-24 text-right text-xs text-ink-500">
                {stage.dealCount} {stage.dealCount === 1 ? "deal" : "deals"}
              </span>
              {closed ? (
                <span className="flex w-8 justify-center text-ink-300" title="Won and Lost are built in">
                  <Lock className="size-4" aria-label="Built-in stage" />
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`Remove ${stage.name}`}
                  disabled={pending}
                  onClick={() => run(() => deleteStage(stage.id), `Removed "${stage.name}".`)}
                  className="flex w-8 justify-center rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <form
        className="flex flex-wrap items-center gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-4"
        action={(formData) => run(() => addStage(pipelineId, formData), `Added "${formData.get("name")}" before Won.`)}
      >
        <input name="name" placeholder="New stage, e.g. Contract & deposit" aria-label="New stage name" className={cn(input, "min-w-56 flex-1")} required maxLength={60} />
        <label className="flex items-center gap-1.5 text-sm text-ink-600">
          <input name="probability" type="number" min={0} max={100} defaultValue={90} aria-label="Win probability for new stage" className={cn(input, "w-20")} />%
        </label>
        <Button size="sm" type="submit" disabled={pending}>
          <Plus className="size-4" aria-hidden /> Add stage
        </Button>
      </form>
    </div>
  );
}
