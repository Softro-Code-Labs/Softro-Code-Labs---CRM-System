"use client";

import { useState, useTransition } from "react";
import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { takeLead } from "@/app/(app)/leads/actions";

/** "Take this lead" for website leads on the New Leads board. The first person to press it gets the lead. */
export function TakeLeadButton({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size={size}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await takeLead(id);
            setError(r?.message ?? null);
          })
        }
      >
        <Hand className="size-4" aria-hidden /> {pending ? "Taking…" : "Take this lead"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
