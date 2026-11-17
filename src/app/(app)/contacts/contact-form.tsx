"use client";

import { useActionState } from "react";
import type { Contact } from "@/generated/prisma/client";
import { CheckboxField, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { LANGUAGE_OPTIONS } from "@/lib/crm-meta";

type Option = { id: string; name: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  contact?: Contact;
  companies: Option[];
  owners: Option[];
  defaultOwnerId: string;
  defaultCompanyId?: string;
  cancelHref: string;
};

export function ContactForm({ action, contact, companies, owners, defaultOwnerId, defaultCompanyId, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (key: keyof Contact) => state.values?.[key] ?? (contact?.[key] as string | null | undefined) ?? "";
  const e = state.errors ?? {};
  const primaryChecked = state.values ? state.values.isPrimary === "on" : (contact?.isPrimary ?? false);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Person</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="First name" name="firstName" required defaultValue={v("firstName")} error={e.firstName} />
          <TextField label="Last name" name="lastName" defaultValue={v("lastName")} error={e.lastName} />
          <TextField label="Job title" name="jobTitle" placeholder="CTO, Procurement Manager…" defaultValue={v("jobTitle")} error={e.jobTitle} />
          <TextField label="Department" name="department" defaultValue={v("department")} error={e.department} />
          <SelectField label="Preferred language" name="language" options={LANGUAGE_OPTIONS} defaultValue={v("language") || "ENGLISH"} error={e.language} />
          <SelectField
            label="Company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No company"
            defaultValue={contact ? v("companyId") : (state.values?.companyId ?? defaultCompanyId ?? "")}
            error={e.companyId}
          />
          <SelectField
            label="Owner"
            name="ownerId"
            options={owners.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Unassigned"
            defaultValue={contact ? v("ownerId") : (state.values?.ownerId ?? defaultOwnerId)}
            error={e.ownerId}
          />
          <div className="sm:col-span-2">
            <CheckboxField
              label="Primary contact"
              name="isPrimary"
              hint="The main person we deal with at this company. Replaces any existing primary contact."
              defaultChecked={primaryChecked}
              key={String(primaryChecked)}
            />
            {e.isPrimary && <p className="mt-1 text-xs text-red-600">{e.isPrimary[0]}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">How to reach them</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Email" name="email" type="email" defaultValue={v("email")} error={e.email} className="sm:col-span-2" />
          <TextField label="Phone" name="phone" type="tel" defaultValue={v("phone")} error={e.phone} />
          <TextField label="Mobile / WhatsApp" name="mobile" type="tel" placeholder="+94 77 123 4567" defaultValue={v("mobile")} error={e.mobile} />
          <TextField label="LinkedIn profile" name="linkedinUrl" placeholder="linkedin.com/in/…" defaultValue={v("linkedinUrl")} error={e.linkedinUrl} className="sm:col-span-2" />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{contact ? "Save changes" : "Create contact"}</SubmitButton>
      </div>
    </form>
  );
}
