"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import type { SealKind } from "@/lib/seal";
import { canSee } from "@/lib/visibility";

type Result = { message?: string };

/** Finds the document, says whether it can be sealed, and where its pages live. */
async function lookup(kind: SealKind, id: string) {
  if (kind === "quote") {
    const q = await db.quote.findUnique({ where: { id }, select: { number: true, status: true, seal: { select: { id: true } } } });
    if (!q) return null;
    return { label: `quote ${q.number}`, entity: "Quote", entityId: id, sealId: q.seal?.id, blocked: q.status === "DECLINED" ? "Declined quotes can't be sealed." : null, paths: [`/quotes/${id}`] };
  }
  if (kind === "invoice") {
    const inv = await db.invoice.findUnique({ where: { id }, select: { number: true, status: true, seal: { select: { id: true } } } });
    if (!inv) return null;
    return { label: `invoice ${inv.number}`, entity: "Invoice", entityId: id, sealId: inv.seal?.id, blocked: inv.status === "VOID" ? "Void invoices can't be sealed." : null, paths: [`/invoices/${id}`] };
  }
  const p = await db.payment.findUnique({ where: { id }, select: { receiptNumber: true, invoiceId: true, invoice: { select: { number: true } }, seal: { select: { id: true } } } });
  if (!p) return null;
  return { label: `receipt ${p.receiptNumber}`, entity: "Invoice", entityId: p.invoiceId, sealId: p.seal?.id, blocked: null, paths: [`/invoices/${p.invoiceId}`] };
}

/** Applies the company seal with the current person's signature. Admins and Managers only. */
export async function sealDocument(kind: SealKind, id: string): Promise<Result> {
  const user = await authorizeAction("document:seal");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const doc = await lookup(kind, id);
  if (!doc || !(await canSee(user, kind === "receipt" ? "payment" : kind, id))) return { message: "This document no longer exists." };
  if (doc.blocked) return { message: doc.blocked };
  if (doc.sealId) return {};

  const [signature, me] = await Promise.all([
    db.userSignature.findUnique({ where: { userId: user.id }, select: { data: true } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, jobTitle: true } }),
  ]);
  if (!signature) return { message: "Add your signature under My profile first. It's printed next to the seal." };

  try {
    await db.documentSeal.create({
      data: {
        ...(kind === "quote" ? { quoteId: id } : kind === "invoice" ? { invoiceId: id } : { paymentId: id }),
        sealedById: user.id,
        signerName: me.name,
        signerTitle: me.jobTitle,
        signature: signature.data,
      },
    });
  } catch (e) {
    // Someone else sealed it at the same moment: that's fine.
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
  await audit({ actorId: user.id, action: "update", entity: doc.entity, entityId: doc.entityId, summary: `Sealed ${doc.label}` });
  doc.paths.forEach((p) => revalidatePath(p));
  return {};
}

/** Removes the seal so the document can be changed. Admins and Managers only. */
export async function unsealDocument(kind: SealKind, id: string): Promise<Result> {
  const user = await authorizeAction("document:seal");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const doc = await lookup(kind, id);
  if (!doc || !(await canSee(user, kind === "receipt" ? "payment" : kind, id))) return { message: "This document no longer exists." };
  if (!doc.sealId) return {};
  await db.documentSeal.deleteMany({ where: { id: doc.sealId } });
  await audit({ actorId: user.id, action: "update", entity: doc.entity, entityId: doc.entityId, summary: `Removed the seal from ${doc.label}` });
  doc.paths.forEach((p) => revalidatePath(p));
  return {};
}
