"use client";

import { useState, useTransition } from "react";
import { setRequireTwoFactor } from "./actions";

export function RequireTwoFactorToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; message: string } | null>(null);
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-ink-800">Require two-step sign-in for admins and managers</span>
          <span className="block text-xs text-ink-500">They can see and change everything, so a stolen password does the most damage. Others can still choose to turn it on.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            start(async () => {
              const r = await setRequireTwoFactor(next);
              setMsg(r);
              if (r.ok) setOn(next);
            });
          }}
        />
        <span aria-hidden className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-ink-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
      </label>
      {msg && <p role="status" className={msg.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{msg.message}</p>}
    </div>
  );
}
