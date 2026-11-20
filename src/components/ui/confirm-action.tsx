"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Result = { message?: string; ok?: boolean } | void;

/**
 * A button that asks before doing something that removes, cancels or turns off.
 * First click shows the question with "Yes" and "No"; only "Yes" runs the action.
 */
export function ConfirmAction({
  children,
  question,
  yes,
  onConfirm,
  variant = "secondary",
  size = "sm",
  iconOnly,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  question: string;
  yes: string;
  onConfirm: () => Promise<Result>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!asking)
    return iconOnly ? (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setAsking(true)}
        className={className}
      >
        {children}
      </button>
    ) : (
      <Button
        type="button"
        size={size}
        variant={variant}
        aria-label={ariaLabel}
        onClick={() => setAsking(true)}
        className={className}
      >
        {children}
      </Button>
    );

  return (
    <span
      className="inline-flex flex-wrap items-center gap-2"
      role="group"
      aria-label={question}
    >
      <span className="text-sm text-ink-600">{question}</span>
      <Button
        type="button"
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await onConfirm();
            if (r && r.message && r.ok !== true) setError(r.message);
            else setAsking(false);
          })
        }
      >
        {pending ? "Working…" : yes}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setAsking(false)}
      >
        No
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
