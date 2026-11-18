"use client";

import { useActionState, useState, useTransition } from "react";
import { FileDown } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState, type FormState } from "@/lib/form";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/crm-meta";
import { deletePayment, recordPayment, voidInvoice } from "../actions";

export function PaymentForm({ invoiceId, balance, today }: { invoiceId: string; balance: string; today: string }) {
  const [state, action] = useActionState<FormState & { receiptId?: string }, FormData>(recordPayment.bind(null, invoiceId), initialFormState);
  const v = state.ok ? undefined : state.values;
  return (
    <form action={action} className="space-y-3" noValidate key={state.ok ? state.receiptId : "form"}>
      {state.ok && state.receiptId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>{state.message}</span>
          <a href={`/receipts/${state.receiptId}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium underline">
            <FileDown className="size-4" aria-hidden /> Receipt PDF
          </a>
        </div>
      ) : (
        <FormMessage message={state.message} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Amount received" name="amount" inputMode="decimal" required defaultValue={v?.amount ?? balance} error={state.errors?.amount} />
        <TextField label="Date received" name="paidAt" type="date" required defaultValue={v?.paidAt ?? today} error={state.errors?.paidAt} />
        <SelectField label="How" name="method" options={PAYMENT_METHOD_OPTIONS} defaultValue={v?.method ?? "BANK_TRANSFER"} />
        <TextField label="Reference" name="reference" placeholder="Bank ref. or cheque no." defaultValue={v?.reference} error={state.errors?.reference} />
      </div>
      <SubmitButton size="sm">Record payment</SubmitButton>
    </form>
  );
}

export function CancelPaymentButton({ id, receipt }: { id: string; receipt: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-ink-500 hover:text-red-600"
      onClick={() => {
        if (window.confirm(`Cancel payment ${receipt}? Use this only if it was recorded by mistake.`)) start(async () => void (await deletePayment(id)));
      }}
    >
      Cancel
    </button>
  );
}

export function VoidButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!confirm)
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
        Void invoice
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-600">Void it? It stays on record as cancelled.</span>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => setError((await voidInvoice(id)).message ?? null))}>
        Yes, void
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        No
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
