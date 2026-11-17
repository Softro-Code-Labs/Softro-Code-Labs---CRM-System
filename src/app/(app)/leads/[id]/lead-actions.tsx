"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLeadResponded, setLeadStatus } from "../actions";
import type { LeadStatus } from "@/generated/prisma/enums";

export function LeadActions({ id, status, responded }: { id: string; status: LeadStatus; responded: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askReason, setAskReason] = useState(false);

  const run = (fn: () => Promise<{ message?: string } | void>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result?.message ?? null);
    });

  if (status === "CONVERTED") return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!responded && (
          <Button size="sm" disabled={pending} onClick={() => run(() => markLeadResponded(id))}>
            <CheckCircle2 className="size-4" aria-hidden /> Mark as replied
          </Button>
        )}
        {status !== "QUALIFIED" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setLeadStatus(id, "QUALIFIED"))}>
            <ThumbsUp className="size-4" aria-hidden /> Qualified
          </Button>
        )}
        {status !== "UNQUALIFIED" && !askReason && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setAskReason(true)}>
            <ThumbsDown className="size-4" aria-hidden /> Not a fit
          </Button>
        )}
        {status === "UNQUALIFIED" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setLeadStatus(id, "CONTACTED"))}>
            Reopen lead
          </Button>
        )}
      </div>
      {askReason && (
        <form
          className="flex flex-wrap items-center gap-2"
          action={(formData) => run(async () => {
            const result = await setLeadStatus(id, "UNQUALIFIED", formData);
            if (!result?.message) setAskReason(false);
            return result;
          })}
        >
          <input
            name="reason"
            autoFocus
            placeholder="Why? e.g. budget too low"
            aria-label="Reason the lead is not a fit"
            className="h-8 min-w-56 flex-1 rounded-lg border border-ink-300 px-3 text-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none"
          />
          <Button size="sm" variant="danger" type="submit" disabled={pending}>
            Mark unqualified
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
