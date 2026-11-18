"use client";

import { useState, useTransition } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoiceFromQuote } from "../../invoices/actions";
import type { FromQuoteMode } from "@/lib/invoices";

/** One click from an accepted quote: the full amount, an advance %, or the balance still to invoice. */
export function InvoiceFromQuote({ quoteId, anyInvoiced, remaining }: { quoteId: string; anyInvoiced: boolean; remaining: string }) {
  const [mode, setMode] = useState<FromQuoteMode>(anyInvoiced ? "balance" : "percent");
  const [percent, setPercent] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options: { value: FromQuoteMode; label: string }[] = anyInvoiced
    ? [
        { value: "balance", label: `Balance (${remaining} + tax)` },
        { value: "percent", label: "Another part payment (%)" },
      ]
    : [
        { value: "percent", label: "Advance (%)" },
        { value: "full", label: "Full amount" },
      ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <legend className="sr-only">What to invoice</legend>
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5">
              <input type="radio" name="invoice-mode" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="accent-brand-600" />
              {o.label}
            </label>
          ))}
        </fieldset>
        {mode === "percent" && (
          <label className="flex items-center gap-1.5 text-sm">
            <input
              aria-label="Percentage"
              inputMode="numeric"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-16 rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-right text-sm text-ink-900"
            />
            %
          </label>
        )}
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await invoiceFromQuote(quoteId, mode, Number(percent));
              if (res?.message) setError(res.message);
            })
          }
        >
          <Receipt className="size-4" aria-hidden /> Create invoice
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
