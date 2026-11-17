"use client";

import { useActionState, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { initialFormState, type FormState } from "@/lib/form";
import { DEFAULT_RESPONSE_HOURS, TICKET_CHANNEL_OPTIONS, TICKET_PRIORITY_OPTIONS } from "@/lib/crm-meta";

export type TicketValues = { subject: string; description: string; priority: string; channel: string; companyId: string; contactId: string; contractId: string; assignedToId: string };
type Option = { id: string; name: string };

export function TicketForm({
  action,
  initial,
  companies,
  contacts,
  contracts,
  users,
  cancelHref,
  isEdit,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: TicketValues;
  companies: Option[];
  contacts: (Option & { companyId: string | null })[];
  contracts: (Option & { companyId: string; responseTimeHours: number | null })[];
  users: Option[];
  cancelHref: string;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (k: keyof TicketValues) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [contractId, setContractId] = useState(initial.contractId);
  const [priority, setPriority] = useState(initial.priority);
  const companyContracts = contracts.filter((c) => c.companyId === companyId);
  const sla = contracts.find((c) => c.id === contractId)?.responseTimeHours ?? DEFAULT_RESPONSE_HOURS[priority as keyof typeof DEFAULT_RESPONSE_HOURS];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />
      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Subject" name="subject" required placeholder="Checkout page shows an error on mobile" defaultValue={v("subject")} error={e.subject} className="sm:col-span-2" />
          <TextAreaField label="What's the problem?" name="description" rows={5} placeholder="Paste the client's message, steps to reproduce, screenshots links…" defaultValue={v("description")} error={e.description} className="sm:col-span-2" />
          <SelectField label="Priority" name="priority" options={TICKET_PRIORITY_OPTIONS} value={priority} onChange={(ev) => setPriority(ev.target.value)} error={e.priority} />
          <SelectField label="Came in by" name="channel" options={TICKET_CHANNEL_OPTIONS} defaultValue={v("channel")} error={e.channel} />
        </div>
      </Card>
      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Client company"
            name="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No company (individual)"
            value={companyId}
            onChange={(ev) => {
              setCompanyId(ev.target.value);
              setContractId(contracts.find((c) => c.companyId === ev.target.value)?.id ?? "");
            }}
            error={e.companyId}
          />
          <SelectField
            label="Reported by"
            name="contactId"
            key={`c-${companyId}`}
            options={contacts.filter((c) => !companyId || c.companyId === companyId).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Not specified"
            defaultValue={companyId === initial.companyId ? v("contactId") : ""}
            error={e.contactId}
          />
          <SelectField
            label="Under contract"
            name="contractId"
            options={companyContracts.map((c) => ({ value: c.id, label: c.name }))}
            placeholder={companyContracts.length ? "No contract" : "No active contract"}
            value={contractId}
            onChange={(ev) => setContractId(ev.target.value)}
            error={e.contractId}
          />
          <SelectField label="Assigned to" name="assignedToId" options={users.map((u) => ({ value: u.id, label: u.name }))} placeholder="Unassigned" defaultValue={v("assignedToId")} error={e.assignedToId} />
          {!isEdit && (
            <p className="text-xs text-ink-500 sm:col-span-2">
              First reply due within <strong>{sla} hours</strong>
              {contractId ? " (contract SLA)" : " (our standard time for this priority)"}.
            </p>
          )}
        </div>
      </Card>
      <div className="flex justify-end gap-3">
        <LinkButton href={cancelHref} variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{isEdit ? "Save ticket" : "Create ticket"}</SubmitButton>
      </div>
    </form>
  );
}
