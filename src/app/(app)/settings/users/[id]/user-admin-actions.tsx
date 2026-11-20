"use client";

import { useState, useTransition } from "react";
import { KeyRound, LockOpen, ShieldOff, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { TempPasswordNotice } from "@/components/crm/temp-password";
import { resetUserPassword, resetUserTwoFactor, setUserActive, unlockUser } from "../actions";

export function UserAdminActions({
  id,
  name,
  email,
  isActive,
  isLocked,
  isSelf,
  hasTwoFactor = false,
}: {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isLocked: boolean;
  isSelf: boolean;
  hasTwoFactor?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  if (isSelf) {
    return <p className="text-sm text-ink-500">This is you. Change your own password from My profile.</p>;
  }

  const run = (fn: () => Promise<{ message?: string; tempPassword?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.message ?? null);
      if (result.tempPassword) setTempPassword(result.tempPassword);
    });
  /** For the pop-up confirmations: same as run, but the pop-up shows any error and waits. */
  const confirmed = async (fn: () => Promise<{ message?: string; tempPassword?: string }>) => {
    const result = await fn();
    if (result.tempPassword) setTempPassword(result.tempPassword);
    if (!result.message) setError(null);
    return result;
  };
  const first = name.split(" ")[0];

  return (
    <div className="space-y-4">
      {tempPassword && <TempPasswordNotice name={name} email={email} password={tempPassword} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {isActive && (
          <ConfirmAction
            title={`Reset ${first}'s password?`}
            body={`${first} is signed out everywhere, and you get a temporary password to give them.`}
            yes="Yes, reset password"
            onConfirm={() => confirmed(() => resetUserPassword(id))}
          >
            <KeyRound className="size-4" aria-hidden /> Reset password
          </ConfirmAction>
        )}

        {isActive && hasTwoFactor && (
          <ConfirmAction
            title={`Reset ${first}'s two-step sign-in?`}
            body="Only if they lost their phone and their recovery codes. They're signed out and set it up again at their next sign-in."
            yes="Yes, reset two-step"
            onConfirm={() => confirmed(() => resetUserTwoFactor(id))}
          >
            <ShieldOff className="size-4" aria-hidden /> Reset two-step sign-in
          </ConfirmAction>
        )}

        {isActive && isLocked && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => unlockUser(id))}>
            <LockOpen className="size-4" aria-hidden /> Unlock sign-in
          </Button>
        )}

        {isActive ? (
          <ConfirmAction
            title={`Deactivate ${name}?`}
            body="They're signed out and can't sign in. Their records stay, and you can reactivate them later."
            yes="Yes, deactivate"
            onConfirm={() => confirmed(() => setUserActive(id, false))}
          >
            <UserX className="size-4" aria-hidden /> Deactivate
          </ConfirmAction>
        ) : (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setUserActive(id, true))}>
            <UserCheck className="size-4" aria-hidden /> Reactivate
          </Button>
        )}
      </div>
    </div>
  );
}
