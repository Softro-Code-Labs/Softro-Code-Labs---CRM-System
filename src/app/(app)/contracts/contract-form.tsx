"use client";

import { useActionState, useState } from "react";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { BILLING_CYCLE_OPTIONS, CONTRACT_TYPE_OPTIONS, CURRENCY_OPTIONS } from "@/lib/crm-meta";

export type ContractValues = {
  title: string;
  type: string;
  companyId: string;
  contactId: string;
  dealId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  billingCycle: string;
  amount: string;
  currency: string;
  autoRenew: boolean;
  renewalNoticeDays: string;
  responseTimeHours: string;
  includedHours: string;
  scope: string;
};

type Option = { id: string; name: string };

export function ContractForm({
  action,
  initial,
  companies,
  contacts,
  deals,
  owners,
  cancelHref,
  isEdit,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: ContractValues;
  companies: Option[];
  contacts: (Option & { companyId: string | null })[];
  deals: (Option & { companyId: string | null })[];
  owners: Option[];
  cancelHref: string;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (k: Exclude<keyof ContractValues, "autoRenew">) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [endDate, setEndDate] = useState(initial.endDate);
  const autoRenew = state.values ? state.values.autoRenew === "on" : initial.autoRenew;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Agreement</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Contract name" name="title" required placeholder="Website maintenance & hosting" defaultValue={v("title")} error={e.title} className="sm:col-span-2" />
          <SelectField label="Type" name="type" options={CONTRACT_TYPE_OPTIONS} defaultValue={v("type")} error={e.type} />
          <SelectField label="Owner" name="ownerId" options={owners.map((o) => ({ value: o.id, label: o.name }))} placeholder="Unassigned" defaultValue={v("ownerId")} error={e.ownerId} />
          <SelectField
            label="Client company"
            name="companyId"
            required
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Choose a company…"
            value={companyId}
            onChange={(ev) => setCompanyId(ev.target.value)}
            error={e.companyId}
          />
          <SelectField
            label="Main contact"
            name="contactId"
            key={`contact-${companyId}`}
            options={contacts.filter((c) => c.companyId === companyId).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No contact"
            defaultValue={companyId === initial.companyId ? v("contactId") : ""}
            error={e.contactId}
          />
          <SelectField
            label="From deal"
            name="dealId"
            key={`deal-${companyId}`}
            options={deals.filter((d) => d.companyId === companyId).map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Not linked"
            defaultValue={companyId === initial.companyId ? v("dealId") : ""}
            error={e.dealId}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Dates and renewal</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField label="Start date" name="startDate" type="date" required defaultValue={v("startDate")} error={e.startDate} />
          <TextField label="End date" name="endDate" type="date" hint="Leave empty if it runs until cancelled." value={endDate} onChange={(ev) => setEndDate(ev.target.value)} error={e.endDate} />
          <TextField
            label="Remind me (days before end)"
            name="renewalNoticeDays"
            inputMode="numeric"
            disabled={!endDate}
            defaultValue={v("renewalNoticeDays")}
            error={e.renewalNoticeDays}
          />
          <div className="sm:col-span-3">
            <CheckboxField label="Usually renews" name="autoRenew" hint="For your reference: the client expects to continue. You still confirm each renewal." defaultChecked={autoRenew} key={String(autoRenew)} />
          </div>
          {endDate && (
            <p className="text-xs text-ink-500 sm:col-span-3">
              A <strong>Renew contract</strong> task is created for the owner before the end date, and it shows on the dashboard.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-900">Billing and service level</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField label="Amount" name="amount" inputMode="decimal" placeholder="15,000" defaultValue={v("amount")} error={e.amount} />
          <SelectField label="Currency" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency")} error={e.currency} />
          <SelectField label="Billed" name="billingCycle" options={BILLING_CYCLE_OPTIONS} defaultValue={v("billingCycle")} error={e.billingCycle} />
          <TextField
            label="First response within (hours)"
            name="responseTimeHours"
            inputMode="numeric"
            hint="Support SLA. Empty = our standard times."
            defaultValue={v("responseTimeHours")}
            error={e.responseTimeHours}
          />
          <TextField label="Support hours included / month" name="includedHours" inputMode="decimal" defaultValue={v("includedHours")} error={e.includedHours} />
          <TextAreaField label="What's covered" name="scope" rows={4} placeholder="Hosting, SSL, monthly backups, security updates, up to 5 hours of small changes…" defaultValue={v("scope")} error={e.scope} className="sm:col-span-3" />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{isEdit ? "Save contract" : "Create contract"}</SubmitButton>
      </div>
    </form>
  );
}
