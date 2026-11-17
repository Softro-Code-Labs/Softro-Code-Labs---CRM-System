"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState } from "@/lib/form";
import { updateProfile } from "./actions";

export function ProfileForm({ initial }: { initial: { name: string; jobTitle: string; phone: string } }) {
  const [state, action] = useActionState(updateProfile, initialFormState);
  const v = (k: keyof typeof initial) => state.values?.[k] ?? initial[k];
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.message} />
      {state.ok && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Profile saved.</p>}
      <TextField label="Full name" name="name" required defaultValue={v("name")} error={e.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Job title" name="jobTitle" defaultValue={v("jobTitle")} error={e.jobTitle} />
        <TextField label="Phone / WhatsApp" name="phone" type="tel" defaultValue={v("phone")} error={e.phone} />
      </div>
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
