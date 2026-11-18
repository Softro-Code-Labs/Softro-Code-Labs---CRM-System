"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoiceFromContract } from "../../invoices/actions";

/** Invoices this period's fee in one click. */
export function InvoiceContractButton({ contractId }: { contractId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => setError((await invoiceFromContract(contractId))?.message ?? null))}>
        <Plus className="size-4" aria-hidden /> Invoice this period
      </Button>
    </span>
  );
}
