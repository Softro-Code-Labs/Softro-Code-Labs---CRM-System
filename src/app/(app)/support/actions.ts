"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyTicket } from "@/lib/integrations/notify";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { nextNumber } from "@/lib/numbering";
import { responseDue } from "@/lib/tickets";
import { ticketCommentSchema, ticketSchema } from "@/lib/validation/contract";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import type { TicketStatus } from "@/generated/prisma/enums";

function refresh(t: { id: string; companyId: string | null; contractId: string | null }) {
  revalidatePath("/support");
  revalidatePath(`/support/${t.id}`);
  revalidatePath("/dashboard");
  if (t.companyId) revalidatePath(`/companies/${t.companyId}`);
  if (t.contractId) revalidatePath(`/contracts/${t.contractId}`);
}

/** Fills the company from the contract or contact, and checks they belong together. */
type LinkResult = { error: Record<string, string[]> } | { companyId: string | null; slaHours: number | null };

async function resolveLinks(data: { companyId: string | null; contactId: string | null; contractId: string | null; assignedToId: string | null }): Promise<LinkResult> {
  const [contract, contact, assignee] = await Promise.all([
    data.contractId ? db.contract.findUnique({ where: { id: data.contractId }, select: { companyId: true, responseTimeHours: true } }) : null,
    data.contactId ? db.contact.findUnique({ where: { id: data.contactId }, select: { companyId: true } }) : null,
    data.assignedToId ? db.user.findFirst({ where: { id: data.assignedToId, isActive: true }, select: { id: true } }) : null,
  ]);
  if (data.contractId && !contract) return { error: { contractId: ["That contract no longer exists."] } };
  if (data.contactId && !contact) return { error: { contactId: ["That contact no longer exists."] } };
  if (data.assignedToId && !assignee) return { error: { assignedToId: ["That person can't be assigned."] } };
  const companyId = data.companyId ?? contract?.companyId ?? contact?.companyId ?? null;
  if (contract && companyId && contract.companyId !== companyId) return { error: { contractId: ["That contract belongs to another company."] } };
  if (contact?.companyId && companyId && contact.companyId !== companyId) return { error: { contactId: ["That contact works at another company."] } };
  if (!companyId && !data.contactId) return { error: { companyId: ["Choose the client: a company or a contact."] } };
  return { companyId, slaHours: contract?.responseTimeHours ?? null };
}

export async function saveTicket(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction(id ? "ticket:update" : "ticket:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = ticketSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const links = await resolveLinks(parsed.data);
  if ("error" in links) return { errors: links.error, values, message: Object.values(links.error)[0]?.[0] };

  const { status: _status, ...data } = parsed.data;
  void _status;
  if (id) {
    const existing = await db.ticket.findUnique({ where: { id } });
    if (!existing) return { message: "This ticket no longer exists." };
    const ticket = await db.ticket.update({
      where: { id },
      data: {
        ...data,
        companyId: links.companyId,
        // Until we've replied, the deadline follows the current priority and contract.
        ...(!existing.firstResponseAt && { responseDueAt: responseDue(existing.createdAt, data.priority, links.slaHours) }),
      },
    });
    await audit({ actorId: user.id, action: "update", entity: "Ticket", entityId: id, summary: `${ticket.number} ${ticket.subject}` });
    if (ticket.assignedToId && ticket.assignedToId !== existing.assignedToId) after(() => notifyTicket(id, user.id, "assigned"));
    refresh(ticket);
    redirect(`/support/${id}`);
  }

  const now = new Date();
  const ticket = await db.$transaction(async (tx) =>
    tx.ticket.create({
      data: {
        ...data,
        companyId: links.companyId,
        number: await nextNumber(tx, "T", now),
        createdById: user.id,
        assignedToId: data.assignedToId ?? user.id,
        responseDueAt: responseDue(now, data.priority, links.slaHours),
      },
    }),
  );
  await audit({ actorId: user.id, action: "create", entity: "Ticket", entityId: ticket.id, summary: `${ticket.number} ${ticket.subject}` });
  after(() => notifyTicket(ticket.id, user.id, "created"));
  refresh(ticket);
  redirect(`/support/${ticket.id}`);
}

export async function setTicketStatus(id: string, status: TicketStatus): Promise<{ message?: string }> {
  const user = await authorizeAction("ticket:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const existing = await db.ticket.findUnique({ where: { id } });
  if (!existing) return { message: "This ticket no longer exists." };
  const now = new Date();
  const ticket = await db.ticket.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? (existing.resolvedAt ?? now) : null,
      closedAt: status === "CLOSED" ? now : null,
    },
  });
  await audit({ actorId: user.id, action: "update", entity: "Ticket", entityId: id, summary: `${ticket.number}: ${existing.status} → ${status}` });
  refresh(ticket);
  return {};
}

export async function assignTicket(id: string, assignedToId: string): Promise<{ message?: string }> {
  const user = await authorizeAction("ticket:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const assignee = assignedToId ? await db.user.findFirst({ where: { id: assignedToId, isActive: true }, select: { id: true, name: true } }) : null;
  if (assignedToId && !assignee) return { message: "That person can't be assigned." };
  const before = await db.ticket.findUnique({ where: { id }, select: { assignedToId: true } });
  if (!before) return { message: "This ticket no longer exists." };
  const ticket = await db.ticket.update({ where: { id }, data: { assignedToId: assignee?.id ?? null } });
  if (assignee && assignee.id !== before.assignedToId) after(() => notifyTicket(id, user.id, "assigned"));
  await audit({ actorId: user.id, action: "update", entity: "Ticket", entityId: id, summary: `${ticket.number}: assigned to ${assignee?.name ?? "nobody"}` });
  refresh(ticket);
  return {};
}

export async function addTicketComment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("ticket:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = ticketCommentSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const ticket = await db.ticket.findUnique({ where: { id } });
  if (!ticket) return { message: "This ticket no longer exists." };

  await db.$transaction(async (tx) => {
    await tx.ticketComment.create({ data: { ticketId: id, authorId: user.id, ...parsed.data } });
    if (parsed.data.isClientReply) {
      await tx.ticket.update({
        where: { id },
        data: {
          firstResponseAt: ticket.firstResponseAt ?? new Date(),
          ...(ticket.status === "OPEN" && { status: "IN_PROGRESS" }),
        },
      });
    }
  });
  refresh(ticket);
  return { ok: true };
}

export async function deleteTicket(id: string) {
  const user = await authorizeAction("ticket:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const ticket = await db.ticket.findUnique({ where: { id } });
  if (!ticket) return { message: "This ticket no longer exists." };
  await db.ticket.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Ticket", entityId: id, summary: `${ticket.number} ${ticket.subject}` });
  refresh(ticket);
  redirect("/support");
}
