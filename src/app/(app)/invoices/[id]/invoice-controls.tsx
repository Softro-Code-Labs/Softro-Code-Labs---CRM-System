"use client";

import { useActionState, useState, useTransition } from "react";
import { FileDown, RotateCcw } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState, type FormState } from "@/lib/form";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/crm-meta";
import {
  deletePayment,
  recordPayment,
  restoreInvoice,
  voidInvoice,
} from "../actions";
import { ConfirmAction } from "@/components/ui/confirm-action";

export function PaymentForm({
  invoiceId,
  balance,
  today,
  currency = "LKR",
}: {
  invoiceId: string;
  balance: string;
  today: string;
  currency?: string;
}) {
  const [state, action] = useActionState<
    FormState & { receiptId?: string },
    FormData
  >(recordPayment.bind(null, invoiceId), initialFormState);
  const v = state.ok ? undefined : state.values;
  return (
    <form
      action={action}
      className="space-y-3"
      noValidate
      key={state.ok ? state.receiptId : "form"}
    >
      {state.ok && state.receiptId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>{state.message}</span>
          <a
            href={`/receipts/${state.receiptId}/pdf`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 font-medium underline"
          >
            <FileDown className="size-4" aria-hidden /> Receipt PDF
          </a>
        </div>
      ) : (
        <FormMessage message={state.message} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={currency === "LKR" ? "Amount received" : `Amount received (${currency})`}
          name="amount"
          inputMode="decimal"
          required
          defaultValue={v?.amount ?? balance}
          error={state.errors?.amount}
        />
        {currency !== "LKR" && (
          <TextField
            label="Rupees credited (LKR)"
            name="amountLkr"
            inputMode="decimal"
            required
            defaultValue={v?.amountLkr}
            error={state.errors?.amountLkr}
            hint={`What the bank credited for this ${currency} payment. Used for income tax and commission.`}
          />
        )}
        <TextField
          label="Date received"
          name="paidAt"
          type="date"
          required
          defaultValue={v?.paidAt ?? today}
          error={state.errors?.paidAt}
        />
        <SelectField
          label="How"
          name="method"
          options={PAYMENT_METHOD_OPTIONS}
          defaultValue={v?.method ?? "BANK_TRANSFER"}
        />
        <TextField
          label="Reference"
          name="reference"
          placeholder="Bank ref. or cheque no."
          defaultValue={v?.reference}
          error={state.errors?.reference}
        />
      </div>
      <SubmitButton size="sm">Record payment</SubmitButton>
    </form>
  );
}

/** One payment, with its receipt. "Cancel" asks below the payment, full width, before anything happens. */
/** One payment, with its receipt and a Cancel that asks in a pop-up first. */
export function PaymentItem({
  id,
  receipt,
  amount,
  detail,
  canCancel,
  seal,
}: {
  id: string;
  receipt: string;
  amount: string;
  detail: string;
  canCancel: boolean;
  seal?: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
      <span className="min-w-0">
        <span className="font-medium text-ink-900 tabular-nums">{amount}</span>
        <span className="block text-xs break-words text-ink-500">{detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <a
          href={`/receipts/${id}/pdf`}
          target="_blank"
          rel="noopener"
          className="font-mono text-xs whitespace-nowrap text-brand-700 hover:underline"
        >
          {receipt}
        </a>
        {seal}
        {canCancel && (
          <ConfirmAction
            iconOnly
            ariaLabel={`Cancel ${receipt}`}
            className="text-xs text-ink-500 hover:text-red-600"
            title={`Cancel payment ${receipt}?`}
            body={`${amount}. Only if it was recorded by mistake. If it's the latest receipt, the next payment reuses its number.`}
            yes="Yes, cancel payment"
            no="No, keep it"
            onConfirm={() => deletePayment(id)}
          >
            Cancel
          </ConfirmAction>
        )}
      </span>
    </li>
  );
}
export function VoidButton({ id, number }: { id: string; number: string }) {
  return (
    <ConfirmAction
      variant="ghost"
      title={`Void invoice ${number}?`}
      body="It stays on record as cancelled and drops out of what's owed. You can restore it later."
      yes="Yes, void it"
      no="No, keep it"
      onConfirm={() => voidInvoice(id)}
    >
      Void invoice
    </ConfirmAction>
  );
}
export function RestoreButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () =>
            setError((await restoreInvoice(id)).message ?? null),
          )
        }
      >
        <RotateCcw className="size-4" aria-hidden /> Restore invoice
      </Button>
    </span>
  );
}
