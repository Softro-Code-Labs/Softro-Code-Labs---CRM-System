"use client";

import { useState, useTransition } from "react";
import { KeyRound, LockOpen, ShieldOff, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [confirm, setConfirm] = useState<"reset" | "deactivate" | "2fa" | null>(null);

  if (isSelf) {
    return <p className="text-sm text-ink-500">This is you. Change your own password from My profile.</p>;
  }

  const run = (fn: () => Promise<{ message?: string; tempPassword?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.message ?? null);
      if (result.tempPassword) setTempPassword(result.tempPassword);
      setConfirm(null);
    });

  return (
    <div className="space-y-4">
      {tempPassword && <TempPasswordNotice name={name} email={email} password={tempPassword} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {isActive &&
          (confirm === "reset" ? (
            <>
              <span className="text-sm text-ink-600">Sign {name.split(" ")[0]} out and create a new temporary password?</span>
              <Button size="sm" disabled={pending} onClick={() => run(() => resetUserPassword(id))}>Yes, reset</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm("reset")}>
              <KeyRound className="size-4" aria-hidden /> Reset password
            </Button>
          ))}

        {isActive &&
          hasTwoFactor &&
          (confirm === "2fa" ? (
            <>
              <span className="text-sm text-ink-600">Only if they lost their phone and recovery codes. They&apos;ll be signed out.</span>
              <Button size="sm" disabled={pending} onClick={() => run(() => resetUserTwoFactor(id))}>Yes, reset</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm("2fa")}>
              <ShieldOff className="size-4" aria-hidden /> Reset two-step sign-in
            </Button>
          ))}

        {isActive && isLocked && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => unlockUser(id))}>
            <LockOpen className="size-4" aria-hidden /> Unlock sign-in
          </Button>
        )}

        {isActive ? (
          confirm === "deactivate" ? (
            <>
              <span className="text-sm text-ink-600">They&apos;ll be signed out and can&apos;t sign in. Their records stay.</span>
              <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => setUserActive(id, false))}>Deactivate</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirm("deactivate")}>
              <UserX className="size-4" aria-hidden /> Deactivate
            </Button>
          )
        ) : (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setUserActive(id, true))}>
            <UserCheck className="size-4" aria-hidden /> Reactivate
          </Button>
        )}
      </div>
    </div>
  );
}
