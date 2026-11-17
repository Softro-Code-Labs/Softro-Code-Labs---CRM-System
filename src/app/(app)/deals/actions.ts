"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { dealSchema, lostReasonSchema, type DealInput } from "@/lib/validation/deal";
import { formToObject, zodErrors, type FormState } from "@/lib/form";

function revalidateDeal(id?: string, companyId?: string | null) {
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/deals/${id}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
}

/** Checks the linked stage/company/contact exist and fit together. */
async function checkLinks(data: DealInput): Promise<{ errors: Record<string, string[]> } | { stage: { id: string; pipelineId: string } }> {
  const [stage, company, contact] = await Promise.all([
    db.pipelineStage.findUnique({ where: { id: data.stageId } }),
    data.companyId ? db.company.findUnique({ where: { id: data.companyId }, select: { id: true } }) : null,
    data.contactId ? db.contact.findUnique({ where: { id: data.contactId }, select: { companyId: true } }) : null,
  ]);
  if (!stage || stage.isWon || stage.isLost) return { errors: { stageId: ["Pick an open stage. Use Won / Lost on the deal page to close it."] } };
  if (data.companyId && !company) return { errors: { companyId: ["That company no longer exists."] } };
  if (data.contactId && !contact) return { errors: { contactId: ["That contact no longer exists."] } };
  if (contact?.companyId && data.companyId && contact.companyId !== data.companyId) {
    return { errors: { contactId: ["This contact works at a different company."] } };
  }
  return { stage };
}

export async function createDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("deal:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = dealSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const links = await checkLinks(parsed.data);
  if ("errors" in links) return { ...links, values };

  const deal = await db.deal.create({
    data: { ...parsed.data, pipelineId: links.stage.pipelineId, ownerId: parsed.data.ownerId ?? user.id },
  });
  await audit({ actorId: user.id, action: "create", entity: "Deal", entityId: deal.id, summary: deal.title });

  revalidateDeal(undefined, deal.companyId);
  redirect(`/deals/${deal.id}`);
}

export async function updateDeal(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("deal:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const existing = await db.deal.findUnique({ where: { id }, include: { stage: true } });
  if (!existing) return { message: "This deal no longer exists." };

  // Closed deals keep their Won/Lost stage; the form doesn't offer it.
  if (existing.status !== "OPEN") values.stageId = existing.stageId;
  const parsed = dealSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  if (existing.status === "OPEN") {
    const links = await checkLinks(parsed.data);
    if ("errors" in links) return { ...links, values };
  }

  const deal = await db.deal.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.stageId !== existing.stageId && { stageChangedAt: new Date() }),
    },
  });
  await audit({ actorId: user.id, action: "update", entity: "Deal", entityId: id, summary: deal.title });

  revalidateDeal(id, deal.companyId);
  redirect(`/deals/${id}`);
}

/** Used by the board (drag & drop) and the stage bar on the deal page. */
export async function moveDealStage(id: string, stageId: string) {
  const user = await authorizeAction("deal:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const [deal, stage] = await Promise.all([
    db.deal.findUnique({ where: { id }, include: { stage: true } }),
    db.pipelineStage.findUnique({ where: { id: stageId } }),
  ]);
  if (!deal) return { message: "This deal no longer exists." };
  if (!stage || stage.pipelineId !== deal.pipelineId || stage.isWon || stage.isLost) return { message: "That stage isn't available." };
  if (deal.status !== "OPEN") return { message: "Reopen the deal before moving it." };
  if (deal.stageId === stageId) return;

  await db.deal.update({ where: { id }, data: { stageId, stageChangedAt: new Date() } });
  await audit({
    actorId: user.id,
    action: "update",
    entity: "Deal",
    entityId: id,
    summary: `${deal.title}: ${deal.stage.name} → ${stage.name}`,
    meta: { fromStageId: deal.stageId, toStageId: stageId },
  });
  revalidateDeal(id, deal.companyId);
}

async function closeDeal(id: string, outcome: "WON" | "LOST", lostReason: string | null) {
  const user = await authorizeAction("deal:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const deal = await db.deal.findUnique({ where: { id }, include: { pipeline: { include: { stages: true } } } });
  if (!deal) return { message: "This deal no longer exists." };
  const stage = deal.pipeline.stages.find((s) => (outcome === "WON" ? s.isWon : s.isLost));
  if (!stage) return { message: `This pipeline has no ${outcome === "WON" ? "Won" : "Lost"} stage.` };

  await db.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id },
      data: { status: outcome, stageId: stage.id, stageChangedAt: new Date(), closedAt: new Date(), lostReason },
    });
    // Winning a deal makes the prospect a customer.
    if (outcome === "WON" && deal.companyId) {
      await tx.company.updateMany({ where: { id: deal.companyId, type: { in: ["PROSPECT", "FORMER_CUSTOMER"] } }, data: { type: "CUSTOMER" } });
    }
  });
  await audit({ actorId: user.id, action: "update", entity: "Deal", entityId: id, summary: `${deal.title}: marked ${outcome.toLowerCase()}`, meta: lostReason ? { lostReason } : undefined });
  revalidateDeal(id, deal.companyId);
}

export async function markDealWon(id: string) {
  return closeDeal(id, "WON", null);
}

export async function markDealLost(id: string, formData: FormData) {
  const parsed = lostReasonSchema.safeParse({ lostReason: formData.get("lostReason") ?? "" });
  if (!parsed.success) return { message: "Please add a short reason so we can learn from it." };
  return closeDeal(id, "LOST", parsed.data.lostReason);
}

export async function reopenDeal(id: string) {
  const user = await authorizeAction("deal:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const deal = await db.deal.findUnique({ where: { id }, include: { pipeline: { include: { stages: { orderBy: { position: "desc" } } } } } });
  if (!deal) return { message: "This deal no longer exists." };
  // Back to the last open stage (e.g. "Design approval").
  const stage = deal.pipeline.stages.find((s) => !s.isWon && !s.isLost);
  if (!stage) return { message: "This pipeline has no open stages." };

  await db.deal.update({
    where: { id },
    data: { status: "OPEN", stageId: stage.id, stageChangedAt: new Date(), closedAt: null, lostReason: null },
  });
  await audit({ actorId: user.id, action: "update", entity: "Deal", entityId: id, summary: `${deal.title}: reopened` });
  revalidateDeal(id, deal.companyId);
}

export async function deleteDeal(id: string) {
  const user = await authorizeAction("deal:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const deal = await db.deal.findUnique({ where: { id }, select: { title: true, companyId: true, leadId: true } });
  if (!deal) return { message: "This deal no longer exists." };

  await db.$transaction(async (tx) => {
    await tx.deal.delete({ where: { id } });
    // Let the original lead be worked (and converted) again.
    if (deal.leadId) await tx.lead.update({ where: { id: deal.leadId }, data: { status: "QUALIFIED", convertedAt: null } });
  });
  await audit({ actorId: user.id, action: "delete", entity: "Deal", entityId: id, summary: deal.title });

  revalidateDeal(undefined, deal.companyId);
  revalidatePath("/leads");
  redirect("/deals");
}
