"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Result = { message?: string; ok?: boolean } | void;

/**
 * A confirmation pop-up in the CRM's own style (not the browser's, which people can switch off).
 * Dims the page; Esc or "No" closes it; only the red button runs the action.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  yes,
  no = "No, go back",
  pending,
  error,
  onYes,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  yes: string;
  no?: string;
  pending?: boolean;
  error?: string | null;
  onYes: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !pending) onClose(); // click on the dimmed backdrop
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-ink-200 bg-white p-0 text-left text-ink-900 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="p-5">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-base font-semibold text-ink-900">
                {title}
              </h2>
              {body && <div className="mt-1 text-sm text-ink-600">{body}</div>}
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onClose} autoFocus>
              {no}
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={pending} onClick={onYes}>
              {pending ? "Working…" : yes}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** A button that opens the confirmation pop-up, and runs the action only on "Yes". */
export function ConfirmAction({
  children,
  title,
  body,
  yes,
  no,
  onConfirm,
  variant = "secondary",
  size = "sm",
  iconOnly,
  ariaLabel,
  className,
  disabled,
}: {
  children: ReactNode;
  title: string;
  body?: ReactNode;
  yes: string;
  no?: string;
  onConfirm: () => Promise<Result>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const openIt = () => {
    setError(null);
    setOpen(true);
  };

  return (
    <>
      {iconOnly ? (
        <button type="button" aria-label={ariaLabel} onClick={openIt} className={className} disabled={disabled}>
          {children}
        </button>
      ) : (
        <Button type="button" size={size} variant={variant} aria-label={ariaLabel} onClick={openIt} className={className} disabled={disabled}>
          {children}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        yes={yes}
        no={no}
        pending={pending}
        error={error}
        onClose={() => setOpen(false)}
        onYes={() =>
          start(async () => {
            const r = await onConfirm();
            if (r && r.message && r.ok !== true) setError(r.message);
            else setOpen(false);
          })
        }
      />
    </>
  );
}
