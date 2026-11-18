"use client";

import { useActionState, useState } from "react";
import { CheckboxField, SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { CURRENCY_OPTIONS, SERVICE_TYPE_OPTIONS } from "@/lib/crm-meta";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  lead: {
    id: string;
    title: string;
    contactName: string | null;
    companyName: string | null;
    companyId: string | null;
    serviceType: string | null;
    estimatedValue: string | null;
    currency: string;
    ownerId: string | null;
  };
  companies: Option[];
  owners: Option[];
  stages: Option[];
  suggestedCompanyId: string | null;
};

export function ConvertLeadForm({ action, lead, companies, owners, stages, suggestedCompanyId }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const initialMode = v("companyMode", lead.companyId || suggestedCompanyId ? "existing" : lead.companyName ? "new" : "none");
  const [mode, setMode] = useState(initialMode);

  const modes = [
    { value: "existing", label: "Existing company" },
    { value: "new", label: "Create new company" },
    { value: "none", label: "No company (individual)" },
  ];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-900">1. Client company</h2>
        <input type="hidden" name="companyMode" value={mode} />
        <div className="mb-5 inline-flex rounded-lg border border-ink-200 bg-ink-50 p-1" role="radiogroup" aria-label="Client company">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                mode === m.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === "existing" && (
          <SelectField
            label="Company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Choose a company…"
            defaultValue={v("companyId", lead.companyId ?? suggestedCompanyId ?? "")}
            error={e.companyId}
          />
        )}
        {mode === "new" && (
          <TextField label="New company name" name="newCompanyName" defaultValue={v("newCompanyName", lead.companyName ?? "")} error={e.newCompanyName} />
        )}
        {mode === "none" && <p className="text-sm text-ink-500">The deal will be linked to the contact only.</p>}

        {lead.contactName && (
          <div className="mt-5 border-t border-ink-100 pt-5">
            <CheckboxField
              label={`Create a contact for ${lead.contactName}`}
              name="createContact"
              hint="Copies their email, phone, WhatsApp and language into Contacts."
              defaultChecked={state.values ? state.values.createContact === "on" : true}
            />
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">2. The deal</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Deal name" name="title" required defaultValue={v("title", lead.title)} error={e.title} className="sm:col-span-2" />
          <TextField label="Value" name="value" inputMode="decimal" placeholder="0" defaultValue={v("value", lead.estimatedValue ?? "")} error={e.value} />
          <SelectField label="Currency" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency", lead.currency)} error={e.currency} />
          <SelectField label="Service" name="serviceType" options={SERVICE_TYPE_OPTIONS} placeholder="Not specified" defaultValue={v("serviceType", lead.serviceType ?? "")} error={e.serviceType} />
          <SelectField label="Starting stage" name="stageId" options={stages.map((s) => ({ value: s.id, label: s.name }))} defaultValue={v("stageId", stages[0]?.id)} error={e.stageId} />
          <TextField label="Expected close date" name="expectedCloseDate" type="date" defaultValue={v("expectedCloseDate")} error={e.expectedCloseDate} />
          <SelectField label="Owner" name="ownerId" options={owners.map((o) => ({ value: o.id, label: o.name }))} placeholder="Unassigned" defaultValue={v("ownerId", lead.ownerId ?? "")} error={e.ownerId} />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={`/leads/${lead.id}`} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton pendingText="Converting…">Convert to deal</SubmitButton>
      </div>
    </form>
  );
}
