"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState } from "@/lib/form";
import { changePassword } from "@/app/change-password/actions";

/** Change-password form. `redirectTo` is where to go afterwards ("" = stay and show a confirmation). */
export function PasswordForm({ redirectTo, submitLabel = "Change password" }: { redirectTo: string; submitLabel?: string }) {
  const [state, action] = useActionState(changePassword.bind(null, redirectTo), initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      {state.ok && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden /> Password changed. Other devices have been signed out.
        </p>
      )}
      <TextField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required error={e.currentPassword} />
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with letters and numbers. A short sentence works well."
        error={e.newPassword}
      />
      <TextField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required error={e.confirmPassword} />
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
