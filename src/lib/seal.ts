import type { Prisma } from "@/generated/prisma/client";

export type SealKind = "quote" | "invoice" | "receipt";

/** What documents load about their seal. */
export const sealSelect = {
  signerName: true,
  signerTitle: true,
  signature: true,
  sealedAt: true,
} satisfies Prisma.DocumentSealSelect;

export type SealInfo = Prisma.DocumentSealGetPayload<{ select: typeof sealSelect }>;

/** The line under the mark: the company registration number from Settings → Company details, or "OFFICIAL". */
export function sealLabel(registrationNo: string | null | undefined) {
  const text = registrationNo?.trim().toUpperCase() || "OFFICIAL";
  // Long numbers get a smaller size so they stay inside the inner ring.
  return { text, scale: Math.min(1, 11 / Math.max(text.length, 1)) };
}

export const SEALED_LOCK_MESSAGE = "This document is sealed. An Admin or Manager has to remove the seal before it can be changed.";
