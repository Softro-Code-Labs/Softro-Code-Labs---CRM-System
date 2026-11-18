"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, Send, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuoteStatus } from "@/generated/prisma/enums";
import { duplicateQuote, setQuoteStatus } from "../actions";

export function QuoteStatusActions({ id, status, canEdit, canCreate, hasOpenDeal }: { id: string; status: QuoteStatus; canEdit: boolean; canCreate: boolean; hasOpenDeal: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ message?: string } | void>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result?.message ?? null);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canEdit && status === "DRAFT" && (
          <Button size="sm" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "SENT"))}>
            <Send className="size-4" aria-hidden /> Mark as sent
          </Button>
        )}
        {canEdit && status === "SENT" && (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "ACCEPTED"))} className="bg-emerald-600 text-on-accent hover:bg-emerald-500">
              <CheckCircle2 className="size-4" aria-hidden /> Accepted
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "DECLINED"))}>
              <XCircle className="size-4" aria-hidden /> Declined
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "DRAFT"))}>
              <Undo2 className="size-4" aria-hidden /> Back to draft
            </Button>
          </>
        )}
        {canEdit && (status === "ACCEPTED" || status === "DECLINED") && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setQuoteStatus(id, "SENT"))}>
            <Undo2 className="size-4" aria-hidden /> Undo
          </Button>
        )}
        {canCreate && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => duplicateQuote(id))}>
            <Copy className="size-4" aria-hidden /> {status === "DRAFT" ? "Duplicate" : "New version"}
          </Button>
        )}
      </div>
      {status === "SENT" && hasOpenDeal && canEdit && <p className="text-xs text-ink-500">Marking it accepted also sets the deal&apos;s value to this quote&apos;s total.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
