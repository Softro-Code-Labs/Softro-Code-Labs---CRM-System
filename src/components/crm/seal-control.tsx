"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { sealDocument, unsealDocument } from "@/app/(app)/seal-actions";
import type { SealKind } from "@/lib/seal";

const NOUN: Record<SealKind, string> = { quote: "quote", invoice: "invoice", receipt: "receipt", handover: "delivery pack" };

/**
 * Apply or remove the company seal. Admins and Managers see the buttons; everyone else only
 * sees that a document is sealed. `compact` is the one-line version used in the payments list.
 */
export function SealControl({
  kind,
  id,
  sealed,
  canSeal,
  hasSignature,
  compact,
}: {
  kind: SealKind;
  id: string;
  sealed: { by: string; on: string } | null;
  canSeal: boolean;
  hasSignature: boolean;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const noun = NOUN[kind];
  if (!sealed && !canSeal) return null;

  const apply = () =>
    start(async () => {
      const r = await sealDocument(kind, id);
      setError(r.message ?? null);
    });

  if (compact) {
    return (
      <span className="flex flex-col items-end gap-0.5 text-xs">
        {sealed ? (
          <>
            <span className="inline-flex items-center gap-1 text-brand-700" title={`Sealed by ${sealed.by} on ${sealed.on}`}>
              <Stamp className="size-3.5" aria-hidden /> Sealed
            </span>
            {canSeal && (
              <ConfirmAction
                iconOnly
                ariaLabel={`Remove the seal from this ${noun}`}
                className="text-ink-500 hover:text-red-600"
                title={`Remove the seal from this ${noun}?`}
                body={`Sealed by ${sealed.by} on ${sealed.on}. The PDF goes back to a blank signature line.`}
                yes="Yes, remove seal"
                no="No, keep it"
                onConfirm={() => unsealDocument(kind, id)}
              >
                Unseal
              </ConfirmAction>
            )}
          </>
        ) : hasSignature ? (
          <button type="button" onClick={apply} disabled={pending} className="inline-flex items-center gap-1 text-ink-500 hover:text-brand-700 disabled:opacity-50">
            <Stamp className="size-3.5" aria-hidden /> {pending ? "Sealing…" : "Seal"}
          </button>
        ) : (
          <Link href="/settings/profile#signature" className="text-ink-500 hover:text-brand-700">
            Add signature to seal
          </Link>
        )}
        {error && <span role="alert" className="text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-5 py-3 text-sm">
      <p className="flex items-start gap-2 text-ink-600">
        <Stamp className={sealed ? "mt-0.5 size-4 shrink-0 text-brand-700" : "mt-0.5 size-4 shrink-0 text-ink-400"} aria-hidden />
        {sealed ? (
          <span>
            <span className="font-medium text-ink-900">Sealed</span> by {sealed.by} on {sealed.on}. It can&apos;t be changed while sealed
            {canSeal ? "." : "; only an Admin or Manager can remove the seal."}
          </span>
        ) : hasSignature ? (
          <span>
            Add the company seal and your signature to this {noun}
            {kind === "handover" ? " (and its warranty and NDA pages)" : ""}. It&apos;s locked from changes until the seal is removed.
          </span>
        ) : (
          <span>
            To seal this {noun}, first{" "}
            <Link href="/settings/profile#signature" className="text-brand-700 hover:underline">
              add your signature
            </Link>{" "}
            under My profile.
          </span>
        )}
      </p>
      {canSeal &&
        (sealed ? (
          <ConfirmAction
            size="sm"
            variant="ghost"
            title={`Remove the seal from this ${noun}?`}
            body="The PDF goes back to a blank signature line, and the document can be changed again."
            yes="Yes, remove seal"
            no="No, keep it"
            onConfirm={() => unsealDocument(kind, id)}
          >
            Remove seal
          </ConfirmAction>
        ) : (
          hasSignature && (
            <Button size="sm" onClick={apply} disabled={pending}>
              <Stamp className="size-4" aria-hidden /> {pending ? "Sealing…" : "Apply seal"}
            </Button>
          )
        ))}
      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
