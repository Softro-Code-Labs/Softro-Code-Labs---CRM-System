"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState, type FormState } from "@/lib/form";
import { CURRENCY_OPTIONS, QUOTE_UNITS, SERVICE_TYPE_OPTIONS } from "@/lib/crm-meta";
import { saveProduct, setProductActive } from "./actions";

export type ProductValues = { name: string; description: string; unit: string; unitPrice: string; currency: string; serviceType: string };

function Fields({ state, initial }: { state: FormState; initial: ProductValues }) {
  const v = (k: keyof ProductValues) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <TextField label="Name" name="name" required placeholder="Business website (5 pages)" defaultValue={v("name")} error={e.name} className="sm:col-span-3" />
      <SelectField label="Service" name="serviceType" options={SERVICE_TYPE_OPTIONS} placeholder="—" defaultValue={v("serviceType")} error={e.serviceType} className="sm:col-span-3" />
      <TextField label="Price" name="unitPrice" inputMode="decimal" required defaultValue={v("unitPrice")} error={e.unitPrice} className="sm:col-span-2" />
      <SelectField label="Currency" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency")} error={e.currency} />
      <TextField label="Per" name="unit" list="quote-units" required defaultValue={v("unit")} error={e.unit} className="sm:col-span-3" />
      <datalist id="quote-units">
        {QUOTE_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <TextAreaField label="Description (printed on the quote)" name="description" rows={2} defaultValue={v("description")} error={e.description} className="sm:col-span-6" />
    </div>
  );
}

export function NewProductForm({ defaultCurrency }: { defaultCurrency: string }) {
  const [state, action] = useActionState(saveProduct.bind(null, null), initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      {state.ok && <p role="status" className="text-sm text-emerald-700">Added to the catalogue.</p>}
      <Fields state={state} initial={{ name: "", description: "", unit: "project", unitPrice: "", currency: defaultCurrency, serviceType: "" }} />
      <div className="flex justify-end">
        <SubmitButton size="sm">Add to catalogue</SubmitButton>
      </div>
    </form>
  );
}

export function EditProductRow({ id, initial, isActive, summary }: { id: string; initial: ProductValues; isActive: boolean; summary: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveProduct(id, prev, fd);
    if (result.ok) setEditing(false);
    return result;
  }, initialFormState);

  if (!editing) {
    return (
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{summary}</div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Edit ${initial.name}`}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setProductActive(id, !isActive)}>
          {isActive ? "Archive" : "Restore"}
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      <Fields state={state} initial={initial} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <SubmitButton size="sm">Save</SubmitButton>
      </div>
    </form>
  );
}
