"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckboxField, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

import { FormMessage } from "@/components/ui/form-message";
import { initialFormState } from "@/lib/form";
import { cn } from "@/lib/utils";
import { TICKET_STATUS_LABELS } from "@/lib/crm-meta";
import type { TicketStatus } from "@/generated/prisma/enums";
import { addTicketComment, assignTicket, setTicketStatus } from "../actions";

const FLOW: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"];

export function TicketStatusBar({ id, status, canEdit }: { id: string; status: TicketStatus; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-ink-200 bg-white p-1" role="radiogroup" aria-label="Ticket status">
        {FLOW.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            disabled={!canEdit || pending || status === s}
            onClick={() =>
              startTransition(async () => {
                const r = await setTicketStatus(id, s);
                setError(r.message ?? null);
              })
            }
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium sm:text-sm",
              status === s ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 disabled:hover:bg-transparent",
            )}
          >
            {TICKET_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AssigneeSelect({ id, value, users, canEdit }: { id: string; value: string; users: { id: string; name: string }[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <select
        aria-label="Assigned to"
        defaultValue={value}
        disabled={!canEdit || pending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await assignTicket(id, e.target.value);
            setError(r.message ?? null);
          })
        }
        className="h-8 max-w-44 rounded-lg border border-ink-200 bg-white px-2 text-sm"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function CommentComposer({ id, firstReplyPending }: { id: string; firstReplyPending: boolean }) {
  const [state, action] = useActionState(addTicketComment.bind(null, id), initialFormState);
  const [isReply, setIsReply] = useState(firstReplyPending);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage message={state.message} />
      <TextAreaField
        label={isReply ? "What did you tell the client?" : "Internal note"}
        name="body"
        rows={3}
        placeholder={isReply ? "Hi Nimal, we've found the issue and a fix will be live by 4 pm." : "Cause: payment gateway timeout. Fixed in v1.4.2."}
        defaultValue={state.values?.body}
        error={state.errors?.body}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CheckboxField
          label="This is a reply sent to the client"
          name="isClientReply"
          hint="Counts as our response for the SLA."
          checked={isReply}
          onChange={(e) => setIsReply(e.target.checked)}
        />
        <SubmitButton size="sm">{isReply ? "Log reply" : "Add note"}</SubmitButton>
      </div>
    </form>
  );
}

