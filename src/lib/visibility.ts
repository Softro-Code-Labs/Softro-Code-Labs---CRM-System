import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { OPEN_LEAD_STATUSES } from "@/lib/crm-meta";

/**
 * Who sees which leads, deals, quotations and invoices. One rule everywhere:
 *   Admin   – everything.
 *   Manager – their own records and their team's (users whose manager they are).
 *   Others  – (Sales, Support, Viewer) only records they own or created.
 * Website leads nobody has taken yet sit on the shared New Leads board, which everyone sees.
 *
 * Every list, page, count, report and action that reads these records goes through here.
 */

type Viewer = { id: string; role: Role };

/** People whose records this viewer sees, or null for everyone (Admin). */
export const getVisibleUserIds = cache(async (id: string, role: Role): Promise<string[] | null> => {
  if (role === "ADMIN") return null;
  if (role !== "MANAGER") return [id];
  const team = await db.user.findMany({ where: { managerId: id }, select: { id: true } });
  return [id, ...team.map((u) => u.id)];
});

/** Website leads waiting on the New Leads board: from the website form, nobody owns them yet, still open. */
export const BOARD_LEAD_WHERE = {
  source: "WEBSITE_FORM",
  ownerId: null,
  status: { in: OPEN_LEAD_STATUSES },
} satisfies Prisma.LeadWhereInput;

export type Visibility = Awaited<ReturnType<typeof getVisibility>>;

/** Where-clauses limiting each record type to what this person may see. Combine with `AND: [v.lead, …]`. */
export async function getVisibility(viewer: Viewer) {
  const ids = await getVisibleUserIds(viewer.id, viewer.role);
  if (ids === null) {
    return {
      all: true as const,
      ids: null,
      lead: {} as Prisma.LeadWhereInput,
      deal: {} as Prisma.DealWhereInput,
      quote: {} as Prisma.QuoteWhereInput,
      invoice: {} as Prisma.InvoiceWhereInput,
      /** For reports: records owned by these people (all owners for Admin). */
      owner: {} as { ownerId?: { in: string[] } },
    };
  }
  const mine = { in: ids };
  const deal: Prisma.DealWhereInput = { OR: [{ ownerId: mine }, { createdById: mine }] };
  const quote: Prisma.QuoteWhereInput = { OR: [{ createdById: mine }, { deal: { ownerId: mine } }] };
  return {
    all: false as const,
    ids,
    lead: { OR: [{ ownerId: mine }, { createdById: mine }, BOARD_LEAD_WHERE] } as Prisma.LeadWhereInput,
    deal,
    quote,
    // An invoice is visible to whoever can see its deal or quotation, or who made it.
    invoice: { OR: [{ createdById: mine }, { deal: { ownerId: mine } }, { quote: { createdById: mine } }] } as Prisma.InvoiceWhereInput,
    owner: { ownerId: mine },
  };
}

/** True when this person may open the lead / deal / quotation / invoice / receipt with this id. */
export async function canSee(viewer: Viewer, kind: "lead" | "deal" | "quote" | "invoice" | "payment", id: string) {
  const v = await getVisibility(viewer);
  if (v.all) return true;
  switch (kind) {
    case "lead":
      return (await db.lead.count({ where: { AND: [{ id }, v.lead] } })) > 0;
    case "deal":
      return (await db.deal.count({ where: { AND: [{ id }, v.deal] } })) > 0;
    case "quote":
      return (await db.quote.count({ where: { AND: [{ id }, v.quote] } })) > 0;
    case "invoice":
      return (await db.invoice.count({ where: { AND: [{ id }, v.invoice] } })) > 0;
    case "payment":
      return (await db.payment.count({ where: { id, invoice: v.invoice } })) > 0;
  }
}

/** Who this person may make the owner of a lead or deal: Admin anyone, Manager self and team, others only themselves. */
export async function getAssignableOwners(viewer: Viewer) {
  const ids = await getVisibleUserIds(viewer.id, viewer.role);
  return db.user.findMany({
    where: { isActive: true, role: { not: "VIEWER" }, ...(ids && { id: { in: ids } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Checks a chosen owner is one this person may assign. An empty choice is allowed only for Admins. */
export async function mayAssignOwner(viewer: Viewer, ownerId: string | null | undefined) {
  if (!ownerId) return viewer.role === "ADMIN";
  return (await getAssignableOwners(viewer)).some((u) => u.id === ownerId);
}

/** Owner choices for a form: the people this person may assign, plus the record's current owner so editing doesn't drop them. */
export async function getOwnerOptions(viewer: Viewer, currentOwnerId?: string | null) {
  const owners = await getAssignableOwners(viewer);
  if (currentOwnerId && !owners.some((o) => o.id === currentOwnerId)) {
    const current = await db.user.findUnique({ where: { id: currentOwnerId }, select: { id: true, name: true } });
    if (current) owners.push(current);
  }
  return owners;
}
