"use client";

import { useActionState, useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { CheckboxField, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { initialFormState, type FormState } from "@/lib/form";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/crm-meta";
import { deleteExpense, saveExpense } from "./actions";

export type ExpenseValues = { date: string; category: string; description: string; supplier: string; amount: string; reference: string; notes: string };

/** Phone photos are often 4–8 MB; shrink them in the browser so they fit the upload limit. PDFs go as they are. */
async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1_500_000) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // the server explains if it can't read it
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Fields({ state, initial, hasReceipt }: { state: FormState; initial: ExpenseValues; hasReceipt?: boolean }) {
  const v = (k: keyof ExpenseValues) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <TextField label="Date paid" name="date" type="date" required defaultValue={v("date")} error={e.date} className="sm:col-span-2" />
      <SelectField label="Category" name="category" required options={EXPENSE_CATEGORY_OPTIONS} placeholder="Choose…" defaultValue={v("category")} error={e.category} className="sm:col-span-2" />
      <TextField label="Amount (LKR)" name="amount" inputMode="decimal" required defaultValue={v("amount")} error={e.amount} hint="For foreign payments, the rupees that left the bank." className="sm:col-span-2" />
      <TextField label="What it was for" name="description" required placeholder="Office rent, November" defaultValue={v("description")} error={e.description} className="sm:col-span-3" />
      <TextField label="Paid to" name="supplier" placeholder="Supplier or shop" defaultValue={v("supplier")} error={e.supplier} className="sm:col-span-3" />
      <TextField label="Bill or bank reference" name="reference" defaultValue={v("reference")} error={e.reference} className="sm:col-span-2" />
      <TextField label="Notes" name="notes" defaultValue={v("notes")} error={e.notes} className="sm:col-span-4" />
      <div className="space-y-1.5 sm:col-span-6">
        <label htmlFor="receipt" className="block text-sm font-medium text-ink-700">
          {hasReceipt ? "Replace the bill or receipt" : "Bill or receipt"} <span className="font-normal text-ink-500">(photo or PDF, optional)</span>
        </label>
        <input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-800 hover:file:bg-ink-200" />
        {e.receipt?.length ? <p className="text-xs text-red-600">{e.receipt[0]}</p> : <p className="text-xs text-ink-500">Keep the proof: the tax office can ask for it.</p>}
        {hasReceipt && <CheckboxField label="Remove the current file" name="removeReceipt" />}
      </div>
    </div>
  );
}

/** Wraps the server action so photos are shrunk in the browser before they're sent. */
function useExpenseAction(id: string | null, onSaved?: () => void) {
  const [state, action] = useActionState(async (prev: FormState, fd: FormData) => {
    const file = fd.get("receipt");
    if (file instanceof File && file.size > 0) fd.set("receipt", await shrinkPhoto(file));
    const result = await saveExpense(id, prev, fd);
    if (result.ok) onSaved?.();
    return result;
  }, initialFormState);
  return { state, action };
}

export function NewExpenseForm({ today }: { today: string }) {
  const [round, setRound] = useState(0);
  const { state, action } = useExpenseAction(null, () => setRound((r) => r + 1));
  return (
    <form action={action} className="space-y-4" noValidate key={round}>
      <FormMessage message={state.message} />
      {state.ok && <p role="status" className="text-sm text-emerald-700">Expense added.</p>}
      <Fields state={state.ok ? initialFormState : state} initial={{ date: today, category: "", description: "", supplier: "", amount: "", reference: "", notes: "" }} />
      <div className="flex justify-end">
        <SubmitButton size="sm">Add expense</SubmitButton>
      </div>
    </form>
  );
}

export function ExpenseRow({ id, initial, hasReceipt, summary }: { id: string; initial: ExpenseValues; hasReceipt: boolean; summary: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const { state, action } = useExpenseAction(id, () => setEditing(false));

  if (!editing) {
    return (
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{summary}</div>
        {hasReceipt && (
          <a href={`/expenses/${id}/receipt`} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Open the receipt for ${initial.description}`}>
            <FileText className="size-4" aria-hidden /> <span className="hidden sm:inline">Receipt</span>
          </a>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${initial.description}`}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <ConfirmDelete action={() => deleteExpense(id)} title="Delete this expense?" body={`${initial.description}. Its receipt is deleted too. This can't be undone.`} />
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      <Fields state={state} initial={initial} hasReceipt={hasReceipt} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <SubmitButton size="sm">Save</SubmitButton>
      </div>
    </form>
  );
}
