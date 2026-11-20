"use client";

import { useState, useTransition } from "react";
import { Ban, Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContractStatus } from "@/generated/prisma/enums";
import { renewContract, setContractStatus } from "../actions";
import { ConfirmAction } from "@/components/ui/confirm-action";

export function ContractActions({ id, status, canRenew }: { id: string; status: ContractStatus; canRenew: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ message?: string } | void>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r?.message ?? null);
    });

  if (status === "ENDED") return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canRenew && status !== "CANCELLED" && (
          <Button size="sm" disabled={pending} onClick={() => run(() => renewContract(id))}>
            <RefreshCw className="size-4" aria-hidden /> Renew for another period
          </Button>
        )}
        {status === "ACTIVE" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setContractStatus(id, "PAUSED"))}>
            <Pause className="size-4" aria-hidden /> Pause
          </Button>
        )}
        {(status === "PAUSED" || status === "CANCELLED") && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setContractStatus(id, "ACTIVE"))}>
            <Play className="size-4" aria-hidden /> Reactivate
          </Button>
        )}
        {status !== "CANCELLED" && (
          <ConfirmAction
            variant="ghost"
            title="Cancel this contract?"
            body="Renewal reminders stop and it's marked cancelled. You can reactivate it later."
            yes="Yes, cancel contract"
            no="No, keep it"
            onConfirm={() => setContractStatus(id, "CANCELLED")}
          >
            <Ban className="size-4" aria-hidden /> Cancel contract
          </ConfirmAction>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
