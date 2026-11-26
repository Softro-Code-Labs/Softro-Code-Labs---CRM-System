"use client";

import { useState, useTransition } from "react";
import { Check, History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { addMissingCommissions, setCommissionsPaid } from "./actions";

/** One line: mark paid, or undo. */
export function PaidToggle({ id, paid }: { id: string; paid: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col items-end">
      <Button
        size="sm"
        variant={paid ? "ghost" : "secondary"}
        disabled={pending}
        onClick={() => start(async () => setError((await setCommissionsPaid([id], !paid)).message))}
      >
        {paid ? <RotateCcw className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
        {paid ? "Undo" : "Mark paid"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/** Everything unpaid in the list, in one go (e.g. at month end, with salaries). */
export function PayAllButton({ ids, total }: { ids: string[]; total: string }) {
  if (!ids.length) return null;
  return (
    <ConfirmAction
      title={`Mark ${ids.length} ${ids.length === 1 ? "line" : "lines"} as paid?`}
      body={`${total} in total. Do this once the money has been paid to these people.`}
      yes="Yes, mark paid"
      onConfirm={() => setCommissionsPaid(ids, true)}
    >
      <Check className="size-4" aria-hidden /> Mark all unpaid as paid
    </ConfirmAction>
  );
}

/** Catch-up for payments recorded before commission existed. Safe to run twice. */
export function AddMissingButton({ count }: { count: number }) {
  if (!count) return null;
  return (
    <ConfirmAction
      title={`Add commission for ${count} past ${count === 1 ? "payment" : "payments"}?`}
      body="These payments were recorded before commission was switched on. Commission is added at today's rates, for each deal's current owner and their manager, dated when the client paid."
      yes="Yes, add commission"
      onConfirm={() => addMissingCommissions()}
    >
      <History className="size-4" aria-hidden /> Add missing commission ({count})
    </ConfirmAction>
  );
}
