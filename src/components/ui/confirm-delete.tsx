"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "./button";

/** Two-step delete button that calls a bound server action. */
export function ConfirmDelete({ action, label = "Delete" }: { action: () => Promise<{ message?: string } | void>; label?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" aria-hidden /> {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <span className="text-sm text-slate-600">Are you sure?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Cancel
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action();
            if (result?.message) setError(result.message);
          })
        }
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
    </div>
  );
}
