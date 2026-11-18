"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteActivity, deleteNote, toggleActivityDone } from "@/app/(app)/activities/actions";

export function DoneCheckbox({ id, done, canToggle, label }: { id: string; done: boolean; canToggle: boolean; label: string }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checked = optimistic ?? done;

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? `Mark "${label}" as not done` : `Mark "${label}" as done`}
        disabled={!canToggle || pending}
        onClick={() =>
          startTransition(async () => {
            setOptimistic(!checked);
            const result = await toggleActivityDone(id);
            if (result?.message) {
              setError(result.message);
              setOptimistic(null);
            }
          })
        }
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-ink-300 hover:border-ink-600",
          !canToggle && "cursor-not-allowed opacity-50",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function DeleteEntryButton({ id, kind }: { id: string; kind: "activity" | "note" }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded p-1 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:bg-ink-100 hover:text-red-600 focus:opacity-100"
        aria-label={`Delete ${kind}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      {error && <span className="text-red-600">{error}</span>}
      <button type="button" className="text-ink-500 hover:text-ink-800" onClick={() => setConfirming(false)} disabled={pending}>
        Cancel
      </button>
      <button
        type="button"
        className="font-medium text-red-600 hover:text-red-700"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = kind === "note" ? await deleteNote(id) : await deleteActivity(id);
            if (result?.message) setError(result.message);
          })
        }
      >
        Delete
      </button>
    </span>
  );
}
