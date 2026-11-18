"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows a one-time temporary password with a copy button. It's never shown again. */
export function TempPasswordNotice({ name, email, password }: { name: string; email: string; password: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <KeyRound className="size-4" aria-hidden /> Temporary password for {name}
      </p>
      <p className="mt-3 font-mono text-lg tracking-wide text-ink-900 select-all">{password}</p>
      <p className="mt-2 text-xs text-amber-800">
        Copy it now; it won&apos;t be shown again. Send it privately (e.g. WhatsApp). They&apos;ll choose their own password when they first sign in.
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-3"
        onClick={async () => {
          const message = [
            `Hi ${name.split(" ")[0]}, your Softro CRM account is ready.`,
            `Sign in: ${window.location.origin}/login`,
            ...(email ? [`Email: ${email}`] : []),
            `Temporary password: ${password}`,
            "You'll be asked to choose your own password.",
          ].join("\n");
          await navigator.clipboard.writeText(message);
          setCopied(true);
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied sign-in message" : "Copy sign-in message"}
      </Button>
    </div>
  );
}
