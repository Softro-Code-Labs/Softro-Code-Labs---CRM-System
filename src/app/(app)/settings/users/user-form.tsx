"use client";

import { useActionState, useState } from "react";
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

type Values = { name: string; email: string; role: Role; jobTitle: string; phone: string; managerId: string };

export function UserForm({
  action,
  initial,
  isEdit,
  managers,
}: {
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  initial: Values;
  isEdit?: boolean;
  managers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(action, initialFormState as UserFormState);
  const v = (k: keyof Values) => state.values?.[k] ?? initial[k] ?? "";
  const e = state.errors ?? {};
  // Admins and Managers aren't in a team, so the manager choice only shows for the other roles.
  const [role, setRole] = useState<string>(v("role"));
  const inTeam = role !== "ADMIN" && role !== "MANAGER";

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
              onChange={(ev) => setRole(ev.target.value)}
              error={e.role}
            />
            <p className="mt-1.5 text-xs text-ink-500">The full permissions table is in the user guide (docs/USER-GUIDE.md), section 3.</p>
          </div>
          {inTeam && (
            <div className="sm:col-span-2">
              <SelectField
                label="Manager (team)"
                name="managerId"
                placeholder="No manager"
                options={managers.map((m) => ({ value: m.id, label: m.name }))}
                defaultValue={v("managerId")}
                error={e.managerId}
                hint="For Sales, Support and Viewer. Their manager sees their leads, deals and quotations. Admins and Managers aren't in a team."
              />
            </div>
          )}
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
