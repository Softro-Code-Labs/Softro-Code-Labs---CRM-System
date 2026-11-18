"use client";

import { useActionState, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { CURRENCY_OPTIONS, SERVICE_TYPE_OPTIONS } from "@/lib/crm-meta";

type Option = { id: string; name: string };

export type DealFormValues = {
  title: string;
  value: string;
  currency: string;
  serviceType: string;
  stageId: string;
  companyId: string;
  contactId: string;
  ownerId: string;
  expectedCloseDate: string;
  description: string;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: DealFormValues;
  isClosed?: boolean;
  isEdit?: boolean;
  companies: Option[];
  contacts: (Option & { companyId: string | null })[];
  owners: Option[];
  stages: Option[];
  cancelHref: string;
};

export function DealForm({ action, initial, isClosed, isEdit, companies, contacts, owners, stages, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (key: keyof DealFormValues) => state.values?.[key] ?? initial[key];
  const e = state.errors ?? {};
  const [companyId, setCompanyId] = useState(v("companyId"));
  const [contactId, setContactId] = useState(v("contactId"));

  // Only show people from the chosen company (plus people without a company).
  const contactOptions = contacts
    .filter((c) => !companyId || !c.companyId || c.companyId === companyId)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />

      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Deal name" name="title" required placeholder="e.g. Inventory & POS system for ABC Hardware" defaultValue={v("title")} error={e.title} className="sm:col-span-2" />
          <TextField label="Value" name="value" inputMode="decimal" placeholder="0" defaultValue={v("value")} error={e.value} />
          <SelectField label="Currency" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency")} error={e.currency} />
          <SelectField label="Service" name="serviceType" options={SERVICE_TYPE_OPTIONS} placeholder="Not specified" defaultValue={v("serviceType")} error={e.serviceType} />
          {isClosed ? (
            <input type="hidden" name="stageId" value={initial.stageId} />
          ) : (
            <SelectField label="Stage" name="stageId" options={stages.map((s) => ({ value: s.id, label: s.name }))} defaultValue={v("stageId")} error={e.stageId} />
          )}
          <SelectField
            label="Company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No company"
            value={companyId}
            onChange={(ev) => {
              setCompanyId(ev.target.value);
              const current = contacts.find((c) => c.id === contactId);
              if (current?.companyId && current.companyId !== ev.target.value) setContactId("");
            }}
            error={e.companyId}
          />
          <SelectField
            label="Main contact"
            name="contactId"
            options={contactOptions}
            placeholder="No contact"
            value={contactId}
            onChange={(ev) => setContactId(ev.target.value)}
            error={e.contactId}
          />
          <TextField label="Expected close date" name="expectedCloseDate" type="date" defaultValue={v("expectedCloseDate")} error={e.expectedCloseDate} />
          <SelectField label="Owner" name="ownerId" options={owners.map((o) => ({ value: o.id, label: o.name }))} placeholder="Unassigned" defaultValue={v("ownerId")} error={e.ownerId} />
          <TextAreaField label="Scope & notes" name="description" rows={5} defaultValue={v("description")} error={e.description} className="sm:col-span-2" />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{isEdit ? "Save changes" : "Create deal"}</SubmitButton>
      </div>
    </form>
  );
}
