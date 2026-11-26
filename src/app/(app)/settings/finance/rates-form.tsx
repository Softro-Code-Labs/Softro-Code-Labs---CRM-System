"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { initialFormState } from "@/lib/form";
import { saveFinanceRates } from "./actions";

type Values = { commissionSalesPercent: string; commissionManagerPercent: string; commissionLeaderPercent: string };

export function RatesForm({ initial }: { initial: Values }) {
  const [state, action] = useActionState(saveFinanceRates, initialFormState);
  const e = state.errors ?? {};
  const v = (k: keyof Values) => state.values?.[k] ?? initial[k];
  const field = (name: keyof Values, label: string, hint: string) => (
    <TextField label={label} name={name} type="number" inputMode="decimal" min={0} max={100} step="0.01" required defaultValue={v(name)} error={e[name]} hint={hint} />
  );

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage message={state.message} />
      {state.ok && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved. New rates apply to payments recorded from now on.</p>}

      <Card>
        <CardHeader title="Sales commission (%)" description="Of what the client pays, without VAT, on invoices for a deal. Contract fees (maintenance, hosting) don't earn commission." />
        <CardBody className="grid gap-5 sm:grid-cols-3">
          {field("commissionSalesPercent", "Sales person", "When the deal owner is not a Manager or Admin.")}
          {field("commissionManagerPercent", "Their manager", "On top, for the sales person's manager (My team).")}
          {field("commissionLeaderPercent", "Manager or Admin sale", "When the deal owner is a Manager or Admin.")}
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>Save rates</SubmitButton>
      </div>
    </form>
  );
}
