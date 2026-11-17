"use client";

import { useActionState } from "react";
import type { Company } from "@/generated/prisma/client";
import { TextAreaField, TextField, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { COMPANY_TYPE_OPTIONS, EMPLOYEE_SIZE_OPTIONS, INDUSTRY_SUGGESTIONS } from "./company-meta";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  company?: Company;
  owners: { id: string; name: string }[];
  defaultOwnerId: string;
  cancelHref: string;
};

export function CompanyForm({ action, company, owners, defaultOwnerId, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  // After a failed submit, show what the user typed rather than the saved record.
  const v = (key: keyof Company) => state.values?.[key] ?? (company?.[key] as string | null | undefined) ?? "";
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Company details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Company name" name="name" required defaultValue={v("name")} error={e.name} className="sm:col-span-2" />
          <SelectField label="Type" name="type" options={COMPANY_TYPE_OPTIONS} defaultValue={v("type") || "PROSPECT"} error={e.type} />
          <TextField label="Industry" name="industry" list="industry-list" defaultValue={v("industry")} error={e.industry} />
          <datalist id="industry-list">
            {INDUSTRY_SUGGESTIONS.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          <SelectField label="Company size" name="employeeSize" options={EMPLOYEE_SIZE_OPTIONS} placeholder="Unknown" defaultValue={v("employeeSize")} error={e.employeeSize} />
          <SelectField
            label="Account owner"
            name="ownerId"
            options={owners.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Unassigned"
            defaultValue={company ? v("ownerId") : defaultOwnerId}
            error={e.ownerId}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Contact information</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Website" name="website" placeholder="example.com" defaultValue={v("website")} error={e.website} />
          <TextField label="General email" name="email" type="email" defaultValue={v("email")} error={e.email} />
          <TextField label="Phone" name="phone" type="tel" placeholder="+94 11 234 5678" defaultValue={v("phone")} error={e.phone} />
          <TextField label="Tax / BR number" name="taxId" defaultValue={v("taxId")} error={e.taxId} />
          <TextField label="Address" name="addressLine" defaultValue={v("addressLine")} error={e.addressLine} className="sm:col-span-2" />
          <TextField label="City" name="city" defaultValue={v("city")} error={e.city} />
          <TextField label="Country" name="country" defaultValue={v("country") || (company ? "" : "Sri Lanka")} error={e.country} />
        </div>
      </Card>

      <Card className="p-6">
        <TextAreaField label="About this company" name="description" hint="Background, tech stack, how we met them, etc." defaultValue={v("description")} error={e.description} />
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{company ? "Save changes" : "Create company"}</SubmitButton>
      </div>
    </form>
  );
}
