"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildQuoteData, nextQuoteNumber } from "@/lib/quotes";
import { quoteSchema, type QuoteInput } from "@/lib/validation/quote";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { formatMoney } from "@/lib/utils";
import { getOrgSettings } from "@/lib/queries/org";
import type { QuoteStatus } from "@/generated/prisma/enums";

function refresh(quote: { id: string; dealId: string | null; companyId: string | null }) {
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quote.id}`);
  if (quote.dealId) revalidatePath(`/deals/${quote.dealId}`);
  if (quote.companyId) revalidatePath(`/companies/${quote.companyId}`);
}

/** Checks linked records exist and belong together; fills company/contact from the deal if missing. */
async function resolveLinks(input: QuoteInput): Promise<{ errors: Record<string, string[]> } | { ok: true }> {
  if (input.dealId) {
    const deal = await db.deal.findUnique({ where: { id: input.dealId }, select: { companyId: true, contactId: true } });
    if (!deal) return { errors: { dealId: ["That deal no longer exists."] } };
    input.companyId ??= deal.companyId;
    input.contactId ??= deal.contactId;
  }
  if (input.companyId && !(await db.company.findUnique({ where: { id: input.companyId }, select: { id: true } }))) {
    return { errors: { companyId: ["That company no longer exists."] } };
  }
  if (input.contactId) {
    const contact = await db.contact.findUnique({ where: { id: input.contactId }, select: { companyId: true } });
    if (!contact) return { errors: { contactId: ["That contact no longer exists."] } };
    if (input.companyId && contact.companyId && contact.companyId !== input.companyId) {
      return { errors: { contactId: ["This contact works at a different company."] } };
    }
  }
  if (!input.companyId && !input.contactId) return { errors: { companyId: ["Choose who the quote is for: a company or a contact."] } };
  return { ok: true };
}

export async function saveQuote(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction(id ? "quote:update" : "quote:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = quoteSchema.safeParse(values);
  if (!parsed.success) {
    // Show line-item problems at the top of the editor.
    const errors = zodErrors(parsed.error);
    const itemError = Object.entries(errors).find(([k]) => k.startsWith("items"))?.[1]?.[0];
    return { errors, values, message: itemError };
  }
  const links = await resolveLinks(parsed.data);
  if ("errors" in links) return { ...links, values, message: Object.values(links.errors)[0]?.[0] };

  const { quote, items } = buildQuoteData(parsed.data);

  if (id) {
    const existing = await db.quote.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return { message: "This quote no longer exists." };
    if (existing.status === "ACCEPTED" || existing.status === "DECLINED") {
      return { message: "Accepted and declined quotes are locked. Duplicate it to make a new version.", values };
    }
    await db.$transaction([
      db.quoteItem.deleteMany({ where: { quoteId: id } }),
      db.quote.update({ where: { id }, data: { ...quote, items: { create: items } } }),
    ]);
    await audit({ actorId: user.id, action: "update", entity: "Quote", entityId: id, summary: quote.title });
    refresh({ id, ...quote });
    redirect(`/quotes/${id}`);
  }

  const created = await db.$transaction(async (tx) =>
    tx.quote.create({
      data: { ...quote, number: await nextQuoteNumber(tx), createdById: user.id, items: { create: items } },
    }),
  );
  await audit({ actorId: user.id, action: "create", entity: "Quote", entityId: created.id, summary: `${created.number} ${created.title}` });
  refresh(created);
  redirect(`/quotes/${created.id}`);
}

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "DECLINED", "DRAFT"],
  ACCEPTED: ["SENT"],
  DECLINED: ["SENT"],
};

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<{ message?: string }> {
  const user = await authorizeAction("quote:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const quote = await db.quote.findUnique({ where: { id }, include: { deal: { select: { id: true, status: true } } } });
  if (!quote) return { message: "This quote no longer exists." };
  if (!TRANSITIONS[quote.status].includes(status)) return { message: "That change isn't possible from the quote's current status." };

  const now = new Date();
  const amount = formatMoney(quote.total, quote.currency);
  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id },
      data: {
        status,
        ...(status === "SENT" && { sentAt: quote.sentAt ?? now, acceptedAt: null, declinedAt: null }),
        ...(status === "ACCEPTED" && { acceptedAt: now }),
        ...(status === "DECLINED" && { declinedAt: now }),
      },
    });
    if (!quote.deal) return;
    if (status === "ACCEPTED" && quote.deal.status === "OPEN") {
      // The accepted quote becomes the deal's value.
      await tx.deal.update({ where: { id: quote.deal.id }, data: { value: quote.total, currency: quote.currency } });
    }
    const message =
      status === "SENT" ? `Quote ${quote.number} sent to the client (${amount}).`
      : status === "ACCEPTED" ? `Quote ${quote.number} accepted (${amount}).${quote.deal.status === "OPEN" ? " Deal value updated to match." : ""}`
      : status === "DECLINED" ? `Quote ${quote.number} declined.`
      : null;
    if (message) {
      await tx.note.create({ data: { body: message, authorId: user.id, dealId: quote.deal.id, companyId: quote.companyId, contactId: quote.contactId } });
    }
  });
  await audit({ actorId: user.id, action: "update", entity: "Quote", entityId: id, summary: `${quote.number}: ${quote.status} → ${status}` });
  refresh(quote);
  if (quote.dealId) revalidatePath("/deals");
  return {};
}

/** Copies a quote as a new draft: the way to revise a sent, accepted or declined quote. */
export async function duplicateQuote(id: string) {
  const user = await authorizeAction("quote:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const source = await db.quote.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!source) return { message: "This quote no longer exists." };
  const org = await getOrgSettings();
  const now = new Date();

  const copy = await db.$transaction(async (tx) =>
    tx.quote.create({
      data: {
        number: await nextQuoteNumber(tx, now),
        title: source.title,
        currency: source.currency,
        issueDate: now,
        validUntil: new Date(now.getTime() + org.defaultValidityDays * 86_400_000),
        introduction: source.introduction,
        terms: source.terms,
        notes: `Copy of ${source.number}.${source.notes ? `\n\n${source.notes}` : ""}`,
        discountPercent: source.discountPercent,
        taxLabel: source.taxLabel,
        taxRate: source.taxRate,
        subtotal: source.subtotal,
        discountTotal: source.discountTotal,
        taxTotal: source.taxTotal,
        total: source.total,
        dealId: source.dealId,
        companyId: source.companyId,
        contactId: source.contactId,
        createdById: user.id,
        items: {
          create: source.items.map(({ position, productId, title, description, quantity, unit, unitPrice, discountPercent, lineTotal }) => ({
            position, productId, title, description, quantity, unit, unitPrice, discountPercent, lineTotal,
          })),
        },
      },
    }),
  );
  await audit({ actorId: user.id, action: "create", entity: "Quote", entityId: copy.id, summary: `${copy.number} (copy of ${source.number})` });
  refresh(copy);
  redirect(`/quotes/${copy.id}/edit`);
}

export async function deleteQuote(id: string) {
  const user = await authorizeAction("quote:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const quote = await db.quote.findUnique({ where: { id } });
  if (!quote) return { message: "This quote no longer exists." };
  // Anyone who can edit quotes can delete their own drafts; managers can delete any quote.
  const ownDraft = quote.status === "DRAFT" && quote.createdById === user.id;
  if (!ownDraft && !can(user.role, "quote:delete")) return { message: "Only managers can delete quotes that were sent. Mark it declined instead." };

  await db.quote.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Quote", entityId: id, summary: `${quote.number} ${quote.title}` });
  refresh(quote);
  redirect(quote.dealId ? `/deals/${quote.dealId}` : "/quotes");
}
