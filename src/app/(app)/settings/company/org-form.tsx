"use client";

import { useActionState } from "react";
import { TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState } from "@/lib/form";
import { saveOrgSettings } from "./actions";

export type OrgValues = Record<
  | "companyName" | "address" | "phone" | "email" | "website" | "registrationNo" | "vatNumber"
  | "defaultTaxLabel" | "defaultTaxRate" | "defaultValidityDays" | "defaultTerms" | "bankDetails" | "quoteFooter",
  string
>;

export function OrgForm({ initial }: { initial: OrgValues }) {
  const [state, action] = useActionState(saveOrgSettings, initialFormState);
  const v = (k: keyof OrgValues) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage message={state.message} />
      {state.ok && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved. New quotes and PDFs use these details.</p>}

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold text-ink-900">Company details</h2>
        <p className="mb-5 text-xs text-ink-500">Printed at the top of every quote.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Company name" name="companyName" required defaultValue={v("companyName")} error={e.companyName} />
          <TextField label="Website" name="website" defaultValue={v("website")} error={e.website} />
          <TextAreaField label="Address" name="address" rows={2} defaultValue={v("address")} error={e.address} className="sm:col-span-2" />
          <TextField label="Phone" name="phone" type="tel" defaultValue={v("phone")} error={e.phone} />
          <TextField label="Email" name="email" type="email" defaultValue={v("email")} error={e.email} />
          <TextField label="Business registration (BR) no." name="registrationNo" defaultValue={v("registrationNo")} error={e.registrationNo} />
          <TextField label="TIN / VAT no." name="vatNumber" hint="Leave empty if not VAT registered." defaultValue={v("vatNumber")} error={e.vatNumber} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold text-ink-900">Quote defaults</h2>
        <p className="mb-5 text-xs text-ink-500">Used for every new quote. Each quote can still change them.</p>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField label="Tax label" name="defaultTaxLabel" defaultValue={v("defaultTaxLabel")} error={e.defaultTaxLabel} />
          <TextField label="Default tax rate (%)" name="defaultTaxRate" inputMode="decimal" hint="0 if you don't charge VAT." defaultValue={v("defaultTaxRate")} error={e.defaultTaxRate} />
          <TextField label="Valid for (days)" name="defaultValidityDays" inputMode="numeric" defaultValue={v("defaultValidityDays")} error={e.defaultValidityDays} />
          <TextAreaField label="Default terms" name="defaultTerms" rows={6} hint="Payment schedule, what's included, revisions, warranty…" defaultValue={v("defaultTerms")} error={e.defaultTerms} className="sm:col-span-3" />
          <TextAreaField label="Bank details" name="bankDetails" rows={4} hint="Printed on quotes so clients can pay the advance." defaultValue={v("bankDetails")} error={e.bankDetails} className="sm:col-span-3" />
          <TextField label="Footer line" name="quoteFooter" placeholder="Thank you for considering Softro Code Labs." defaultValue={v("quoteFooter")} error={e.quoteFooter} className="sm:col-span-3" />
        </div>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>Save company details</SubmitButton>
      </div>
    </form>
  );
}
