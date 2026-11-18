"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { formatMoney } from "@/lib/utils";
import { getOrgSettings } from "@/lib/queries/org";
import { nextNumber } from "@/lib/numbering";
import { colomboDayBounds } from "@/lib/working-days";
import { invoiceSchema, paymentSchema, type InvoiceInput } from "@/lib/validation/invoice";
import { balanceDue, buildInvoiceData, isEditable, linesFromContract, linesFromQuote, syncFollowUpTask, type FromQuoteMode } from "@/lib/invoices";

const DAY = 86_400_000;

function refresh(inv: { id: string; dealId: string | null; companyId: string | null; quoteId?: string | null; contractId?: string | null }) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${inv.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/activities");
  if (inv.dealId) revalidatePath(`/deals/${inv.dealId}`);
  if (inv.companyId) revalidatePath(`/companies/${inv.companyId}`);
  if (inv.quoteId) revalidatePath(`/quotes/${inv.quoteId}`);
  if (inv.contractId) revalidatePath(`/contracts/${inv.contractId}`);
}

async function dealOwner(dealId: string | null) {
  if (!dealId) return null;
  return (await db.deal.findUnique({ where: { id: dealId }, select: { ownerId: true } }))?.ownerId ?? null;
}

/** Fills company/contact from the deal or contract, and checks they belong together. */
async function resolveLinks(input: InvoiceInput): Promise<{ errors: Record<string, string[]> } | { ok: true }> {
  if (input.dealId) {
    const deal = await db.deal.findUnique({ where: { id: input.dealId }, select: { companyId: true, contactId: true } });
    if (!deal) return { errors: { dealId: ["That deal no longer exists."] } };
    input.companyId ??= deal.companyId;
    input.contactId ??= deal.contactId;
  }
  if (input.contractId) {
    const contract = await db.contract.findUnique({ where: { id: input.contractId }, select: { companyId: true, contactId: true } });
    if (!contract) return { errors: { contractId: ["That contract no longer exists."] } };
    input.companyId ??= contract.companyId;
    input.contactId ??= contract.contactId;
  }
  if (input.contactId && input.companyId) {
    const contact = await db.contact.findUnique({ where: { id: input.contactId }, select: { companyId: true } });
    if (contact?.companyId && contact.companyId !== input.companyId) return { errors: { contactId: ["This contact works at a different company."] } };
  }
  if (!input.companyId && !input.contactId) return { errors: { companyId: ["Choose who the invoice is for: a company or a contact."] } };
  return { ok: true };
}

export async function saveInvoice(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction(id ? "invoice:update" : "invoice:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = invoiceSchema.safeParse(values);
  if (!parsed.success) {
    const errors = zodErrors(parsed.error);
    const itemError = Object.entries(errors).find(([k]) => k.startsWith("items"))?.[1]?.[0];
    return { errors, values, message: itemError };
  }
  const links = await resolveLinks(parsed.data);
  if ("errors" in links) return { ...links, values, message: Object.values(links.errors)[0]?.[0] };
  const { invoice, items } = buildInvoiceData(parsed.data);
  const owner = await dealOwner(invoice.dealId);

  if (id) {
    const existing = await db.invoice.findUnique({ where: { id }, select: { status: true, amountPaid: true } });
    if (!existing) return { message: "This invoice no longer exists." };
    if (!isEditable(existing)) return { message: "Invoices with payments, or void ones, can't be changed.", values };
    await db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      const saved = await tx.invoice.update({ where: { id }, data: { ...invoice, items: { create: items } } });
      await syncFollowUpTask(tx, saved, owner);
    });
    await audit({ actorId: user.id, action: "update", entity: "Invoice", entityId: id, summary: invoice.title });
    refresh({ id, ...invoice });
    redirect(`/invoices/${id}`);
  }

  const created = await db.$transaction(async (tx) => {
    const saved = await tx.invoice.create({ data: { ...invoice, number: await nextNumber(tx, "INV"), createdById: user.id, items: { create: items } } });
    await syncFollowUpTask(tx, saved, owner);
    return saved;
  });
  await audit({ actorId: user.id, action: "create", entity: "Invoice", entityId: created.id, summary: `${created.number} ${created.title} (${formatMoney(created.total, created.currency)})` });
  refresh(created);
  redirect(`/invoices/${created.id}`);
}

/** Invoice an accepted quote in one click: the whole amount, an advance %, or the balance still to bill. */
export async function invoiceFromQuote(quoteId: string, mode: FromQuoteMode, percent = 50): Promise<{ message: string }> {
  const user = await authorizeAction("invoice:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  if (mode === "percent" && !(percent > 0 && percent < 100)) return { message: "Enter a percentage between 1 and 99." };
  const [quote, org] = await Promise.all([db.quote.findUnique({ where: { id: quoteId }, include: { items: { orderBy: { position: "asc" } } } }), getOrgSettings()]);
  if (!quote) return { message: "This quote no longer exists." };
  if (quote.status !== "ACCEPTED") return { message: "Only accepted quotes can be invoiced." };
  const owner = await dealOwner(quote.dealId);
  const today = colomboDayBounds(new Date()).start;

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const { totals, items } = await linesFromQuote(quote, mode, percent, tx);
      const inv = await tx.invoice.create({
        data: {
          number: await nextNumber(tx, "INV"),
          title: quote.title,
          currency: quote.currency,
          issueDate: today,
          dueDate: new Date(today.getTime() + org.invoiceDueDays * DAY),
          terms: org.invoiceTerms,
          discountPercent: mode === "full" ? quote.discountPercent : 0,
          taxLabel: quote.taxLabel,
          taxRate: quote.taxRate,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          dealId: quote.dealId,
          companyId: quote.companyId,
          contactId: quote.contactId,
          quoteId: quote.id,
          createdById: user.id,
          items: { create: items },
        },
      });
      await syncFollowUpTask(tx, inv, owner);
      return inv;
    });
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Couldn't create the invoice." };
  }
  await audit({ actorId: user.id, action: "create", entity: "Invoice", entityId: created.id, summary: `${created.number} from ${quote.number} (${formatMoney(created.total, created.currency)})` });
  refresh(created);
  redirect(`/invoices/${created.id}`);
}

/** This period's fee for a maintenance, hosting or support contract. */
export async function invoiceFromContract(contractId: string): Promise<{ message: string }> {
  const user = await authorizeAction("invoice:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const [contract, org] = await Promise.all([db.contract.findUnique({ where: { id: contractId } }), getOrgSettings()]);
  if (!contract) return { message: "This contract no longer exists." };
  if (Number(contract.amount) <= 0) return { message: "Set the contract's amount first." };
  const today = colomboDayBounds(new Date()).start;
  const { totals, items } = linesFromContract(contract, Number(org.defaultTaxRate));
  const owner = await dealOwner(contract.dealId);
  const created = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number: await nextNumber(tx, "INV"),
        title: contract.title,
        currency: contract.currency,
        issueDate: today,
        dueDate: new Date(today.getTime() + org.invoiceDueDays * DAY),
        terms: org.invoiceTerms,
        taxLabel: org.defaultTaxLabel,
        taxRate: org.defaultTaxRate,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        dealId: contract.dealId,
        companyId: contract.companyId,
        contactId: contract.contactId,
        contractId: contract.id,
        createdById: user.id,
        items: { create: items },
      },
    });
    await syncFollowUpTask(tx, inv, owner ?? contract.ownerId);
    return inv;
  });
  await audit({ actorId: user.id, action: "create", entity: "Invoice", entityId: created.id, summary: `${created.number} for ${contract.number} (${formatMoney(created.total, created.currency)})` });
  refresh(created);
  redirect(`/invoices/${created.id}`);
}

/** Money received. Makes a numbered receipt; marks the invoice paid when nothing is left. */
export async function recordPayment(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState & { receiptId?: string }> {
  const user = await authorizeAction("payment:record");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { message: "This invoice no longer exists." };
  if (inv.status !== "ISSUED") return { message: inv.status === "PAID" ? "This invoice is already paid." : "This invoice is void." };
  const due = balanceDue(inv);
  const amount = Math.round(parsed.data.amount * 100) / 100;
  if (amount > due + 0.005) return { errors: { amount: [`That's more than the balance (${formatMoney(due, inv.currency)}).`] }, values };

  const owner = await dealOwner(inv.dealId);
  const payment = await db.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: { receiptNumber: await nextNumber(tx, "RCT"), invoiceId, amount, method: parsed.data.method, paidAt: parsed.data.paidAt!, reference: parsed.data.reference, notes: parsed.data.notes, recordedById: user.id },
    });
    const paidInFull = amount >= due - 0.005;
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid: { increment: amount }, ...(paidInFull && { status: "PAID", paidAt: parsed.data.paidAt }) },
    });
    await syncFollowUpTask(tx, updated, owner);
    return p;
  });
  await audit({ actorId: user.id, action: "create", entity: "Invoice", entityId: invoiceId, summary: `${payment.receiptNumber}: ${formatMoney(amount, inv.currency)} received for ${inv.number}` });
  refresh(inv);
  return { ok: true, message: `Payment recorded. Receipt ${payment.receiptNumber}.`, receiptId: payment.id };
}

/** For a payment recorded by mistake. The receipt number isn't reused. */
export async function deletePayment(paymentId: string): Promise<{ message?: string }> {
  const user = await authorizeAction("payment:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
  if (!p) return {};
  const owner = await dealOwner(p.invoice.dealId);
  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: paymentId } });
    const updated = await tx.invoice.update({
      where: { id: p.invoiceId },
      data: { amountPaid: { decrement: p.amount }, ...(p.invoice.status === "PAID" && { status: "ISSUED", paidAt: null }) },
    });
    await syncFollowUpTask(tx, updated, owner);
  });
  await audit({ actorId: user.id, action: "delete", entity: "Invoice", entityId: p.invoiceId, summary: `Cancelled ${p.receiptNumber} (${formatMoney(p.amount, p.invoice.currency)}) on ${p.invoice.number}` });
  refresh(p.invoice);
  return {};
}

/** Cancels an invoice that was sent by mistake. Kept for the record, never deleted. */
export async function voidInvoice(id: string): Promise<{ message?: string }> {
  const user = await authorizeAction("invoice:void");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) return {};
  if (Number(inv.amountPaid) > 0) return { message: "This invoice has payments. Cancel them first." };
  await db.$transaction(async (tx) => {
    const updated = await tx.invoice.update({ where: { id }, data: { status: "VOID", voidedAt: new Date() } });
    await syncFollowUpTask(tx, updated, null);
  });
  await audit({ actorId: user.id, action: "update", entity: "Invoice", entityId: id, summary: `Voided ${inv.number}` });
  refresh(inv);
  return {};
}
