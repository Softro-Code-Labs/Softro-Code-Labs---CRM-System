"use client";

import { useActionState, useState } from "react";
import type { Lead } from "@/generated/prisma/client";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import {
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
} from "@/lib/crm-meta";

type Option = { id: string; name: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  lead?: Omit<Lead, "estimatedValue"> & { estimatedValue: string | null };
  companies: Option[];
  owners: Option[];
  defaultOwnerId: string;
  defaultCurrency: string;
  cancelHref: string;
};

export function LeadForm({ action, lead, companies, owners, defaultOwnerId, defaultCurrency, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (key: keyof NonNullable<Props["lead"]>, fallback = "") =>
    state.values?.[key] ?? (lead?.[key] as string | null | undefined) ?? fallback;
  const e = state.errors ?? {};
  const [status, setStatus] = useState(v("status", "NEW"));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Enquiry</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Title"
            name="title"
            required
            placeholder="e.g. Booking system for a salon in Galle"
            defaultValue={v("title")}
            error={e.title}
            className="sm:col-span-2"
          />
          <SelectField label="What do they want to build?" name="serviceType" options={SERVICE_TYPE_OPTIONS} placeholder="Not specified" defaultValue={v("serviceType")} error={e.serviceType} />
          <SelectField label="Source" name="source" options={LEAD_SOURCE_OPTIONS} defaultValue={v("source", "WHATSAPP")} error={e.source} />
          <TextField label="Estimated value" name="estimatedValue" inputMode="decimal" placeholder="250,000" defaultValue={v("estimatedValue")} error={e.estimatedValue} />
          <SelectField label="Currency" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency", defaultCurrency)} error={e.currency} />
          {lead ? (
            <SelectField
              label="Status"
              name="status"
              options={LEAD_STATUS_OPTIONS.filter((o) => o.value !== "CONVERTED" || lead.status === "CONVERTED")}
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
              error={e.status}
            />
          ) : (
            <input type="hidden" name="status" value="NEW" />
          )}
          <SelectField
            label="Owner"
            name="ownerId"
            options={owners.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Unassigned"
            defaultValue={lead ? v("ownerId") : (state.values?.ownerId ?? defaultOwnerId)}
            error={e.ownerId}
          />
          {lead && status === "UNQUALIFIED" && (
            <TextField label="Why unqualified?" name="disqualifyReason" placeholder="Budget too low, not a fit, no response…" defaultValue={v("disqualifyReason")} error={e.disqualifyReason} className="sm:col-span-2" />
          )}
          <TextAreaField label="Their idea / requirements" name="description" rows={5} defaultValue={v("description")} error={e.description} className="sm:col-span-2" />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Who is it from?</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Contact name" name="contactName" defaultValue={v("contactName")} error={e.contactName} />
          <SelectField label="Preferred language" name="language" options={LANGUAGE_OPTIONS} defaultValue={v("language", "ENGLISH")} error={e.language} />
          <TextField label="WhatsApp" name="whatsapp" type="tel" placeholder="077 123 4567" defaultValue={v("whatsapp")} error={e.whatsapp} />
          <TextField label="Phone" name="phone" type="tel" defaultValue={v("phone")} error={e.phone} />
          <TextField label="Email" name="email" type="email" defaultValue={v("email")} error={e.email} className="sm:col-span-2" />
          <TextField label="Business name" name="companyName" hint="As they told you. Link an existing company below if we already have one." defaultValue={v("companyName")} error={e.companyName} />
          <SelectField
            label="Existing company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="None"
            defaultValue={v("companyId")}
            error={e.companyId}
          />
          {!lead && (
            <div className="sm:col-span-2">
              <CheckboxField label="I've already replied to them" name="alreadyReplied" hint="Skips the 2-working-day reply reminder." />
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{lead ? "Save changes" : "Create lead"}</SubmitButton>
      </div>
    </form>
  );
}
