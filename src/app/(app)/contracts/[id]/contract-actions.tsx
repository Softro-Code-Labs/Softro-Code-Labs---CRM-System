"use client";

import { useState, useTransition } from "react";
import { Ban, Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContractStatus } from "@/generated/prisma/enums";
import { renewContract, setContractStatus } from "../actions";

export function ContractActions({ id, status, canRenew }: { id: string; status: ContractStatus; canRenew: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const run = (fn: () => Promise<{ message?: string } | void>) =>
    startTransition(async () => {
      const r = await fn();
      setError(r?.message ?? null);
      setConfirmCancel(false);
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
        {status !== "CANCELLED" &&
          (confirmCancel ? (
            <>
              <span className="self-center text-sm text-ink-600">Cancel this contract?</span>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => setContractStatus(id, "CANCELLED"))}>
                Yes, cancel it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
                No
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmCancel(true)}>
              <Ban className="size-4" aria-hidden /> Cancel contract
            </Button>
          ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
