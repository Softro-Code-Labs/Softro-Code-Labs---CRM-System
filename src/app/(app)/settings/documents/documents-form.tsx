"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState } from "@/lib/form";
import { saveDeliveryDocs } from "./actions";

type Values = { supportMonths: string; warrantyMonths: string; warrantyTerms: string; ndaTerms: string };

function Wording({ name, label, value, onChange, onReset, error }: { name: string; label: string; value: string; onChange: (v: string) => void; onReset: () => void; error?: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={name} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        <Button type="button" size="sm" variant="ghost" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden /> Starting text
        </Button>
      </div>
      <textarea
        id={name}
        name={name}
        rows={22}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-ink-900 shadow-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none"
      />
      {error?.length ? <p className="text-xs text-red-600">{error[0]}</p> : null}
    </div>
  );
}

export function DocumentsForm({ initial, defaults }: { initial: Values; defaults: { warrantyTerms: string; ndaTerms: string } }) {
  const [state, action] = useActionState(saveDeliveryDocs, initialFormState);
  const [warranty, setWarranty] = useState(initial.warrantyTerms);
  const [nda, setNda] = useState(initial.ndaTerms);
  const e = state.errors ?? {};
  const v = (k: keyof Values) => state.values?.[k] ?? initial[k];

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage message={state.message} />
      {state.ok && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved. New Delivery Packs use this wording.</p>}

      <Card className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Free bug fixes (months)" name="supportMonths" type="number" min={0} max={120} defaultValue={v("supportMonths")} error={e.supportMonths} hint="From the delivery date. Fills {supportMonths} and {supportUntil}." />
          <TextField label="Warranty (months)" name="warrantyMonths" type="number" min={0} max={120} defaultValue={v("warrantyMonths")} error={e.warrantyMonths} hint="From the delivery date. Fills {warrantyMonths} and {warrantyUntil}." />
        </div>
        <Wording name="warrantyTerms" label="Warranty wording" value={warranty} onChange={setWarranty} onReset={() => setWarranty(defaults.warrantyTerms)} error={e.warrantyTerms} />
      </Card>

      <Card className="p-6">
        <Wording name="ndaTerms" label="Non-disclosure agreement wording" value={nda} onChange={setNda} onReset={() => setNda(defaults.ndaTerms)} error={e.ndaTerms} />
      </Card>

      <div className="flex justify-end">
        <SubmitButton>Save documents</SubmitButton>
      </div>
    </form>
  );
}
