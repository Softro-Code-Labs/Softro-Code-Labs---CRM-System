"use client";

import { useActionState, useState } from "react";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState } from "@/lib/form";
import { verifySecondFactor } from "../actions";

export function VerifyForm() {
  const [state, action] = useActionState(verifySecondFactor, initialFormState);
  const [recovery, setRecovery] = useState(false);
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">{recovery ? "Use a recovery code" : "Enter the 6-digit code"}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {recovery ? "Type one of the recovery codes you saved when you set up two-step sign-in. Each code works once." : "Open your authenticator app (Google or Microsoft Authenticator) and enter the code for Softro CRM."}
        </p>
      </div>
      <FormMessage message={state.message} />
      <TextField
        key={recovery ? "r" : "c"}
        label={recovery ? "Recovery code" : "Code"}
        name="code"
        inputMode={recovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        placeholder={recovery ? "ABCD-EFGH" : "123 456"}
        maxLength={recovery ? 9 : 7}
        autoFocus
        required
        className={recovery ? "font-mono uppercase" : "font-mono tracking-[0.3em]"}
        error={state.errors?.code}
      />
      <SubmitButton className="w-full" pendingText="Checking…">
        Verify and sign in
      </SubmitButton>
      <button type="button" onClick={() => setRecovery((r) => !r)} className="w-full text-center text-xs font-medium text-ink-500 hover:text-ink-800">
        {recovery ? "Use my authenticator app instead" : "Lost your phone? Use a recovery code"}
      </button>
    </form>
  );
}
