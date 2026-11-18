"use client";

import { useActionState } from "react";
import type { Role } from "@/generated/prisma/enums";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { TempPasswordNotice } from "@/components/crm/temp-password";
import { initialFormState } from "@/lib/form";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import type { UserFormState } from "./actions";

type Values = { name: string; email: string; role: Role; jobTitle: string; phone: string };

export function UserForm({
  action,
  initial,
  isEdit,
}: {
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  initial: Values;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState as UserFormState);
  const v = (k: keyof Values) => state.values?.[k] ?? initial[k] ?? "";
  const e = state.errors ?? {};

  if (state.tempPassword) {
    return (
      <div className="space-y-4">
        <TempPasswordNotice name={state.values?.name ?? "the new team member"} email={state.values?.email ?? ""} password={state.tempPassword} />
        <div className="flex gap-3">
          <LinkButton href="/settings/users" variant="secondary">
            Back to team
          </LinkButton>
          {state.createdId && <LinkButton href={`/settings/users/${state.createdId}`}>View profile</LinkButton>}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage message={state.message} />
      {state.ok && isEdit && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <Card className="p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Full name" name="name" required defaultValue={v("name")} error={e.name} />
          <TextField label="Work email" name="email" type="email" required placeholder="name@softrocodelabs.com" defaultValue={v("email")} error={e.email} />
          <TextField label="Job title" name="jobTitle" placeholder="Sales lead, Developer…" defaultValue={v("jobTitle")} error={e.jobTitle} />
          <TextField label="Phone / WhatsApp" name="phone" type="tel" defaultValue={v("phone")} error={e.phone} />
          <div className="sm:col-span-2">
            <SelectField
              label="Role"
              name="role"
              options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: `${ROLE_LABELS[r]}: ${ROLE_DESCRIPTIONS[r]}` }))}
              defaultValue={v("role")}
              error={e.role}
            />
            <p className="mt-1.5 text-xs text-ink-500">The full permissions table is in the user guide (docs/USER-GUIDE.md), section 3.</p>
          </div>
        </div>
      </Card>
      <div className="flex justify-end gap-3">
        <LinkButton href="/settings/users" variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton>{isEdit ? "Save changes" : "Add and create password"}</SubmitButton>
      </div>
    </form>
  );
}
