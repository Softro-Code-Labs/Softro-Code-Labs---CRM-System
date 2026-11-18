"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyLeadAssigned } from "@/lib/integrations/notify";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { leadSchema } from "@/lib/validation/lead";
import { convertLeadSchema } from "@/lib/validation/deal";
import { formToObject, zodErrors, type FormState } from "@/lib/form";
import { addWorkingDays, REPLY_WITHIN_WORKING_DAYS } from "@/lib/working-days";
import type { LeadStatus } from "@/generated/prisma/enums";

function revalidateLead(id?: string) {
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/leads/${id}`);
}

async function companyExists(id: string | null) {
  if (!id) return true;
  return Boolean(await db.company.findUnique({ where: { id }, select: { id: true } }));
}

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("lead:create");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  if (!(await companyExists(parsed.data.companyId))) return { errors: { companyId: ["That company no longer exists."] }, values };

  const now = new Date();
  const alreadyReplied = values.alreadyReplied === "on";
  const { status: _ignored, ...data } = parsed.data;
  void _ignored;
  const lead = await db.lead.create({
    data: {
      ...data,
      status: alreadyReplied ? "CONTACTED" : "NEW",
      ownerId: data.ownerId ?? user.id,
      respondBy: addWorkingDays(now, REPLY_WITHIN_WORKING_DAYS),
      respondedAt: alreadyReplied ? now : null,
    },
  });
  await audit({ actorId: user.id, action: "create", entity: "Lead", entityId: lead.id, summary: lead.title });
  if (lead.ownerId && lead.ownerId !== user.id) after(() => notifyLeadAssigned(lead.id, user.id));

  revalidateLead();
  redirect(`/leads/${lead.id}`);
}

export async function updateLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("lead:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  if (!(await companyExists(parsed.data.companyId))) return { errors: { companyId: ["That company no longer exists."] }, values };

  const existing = await db.lead.findUnique({ where: { id }, select: { status: true, respondedAt: true, ownerId: true } });
  if (!existing) return { message: "This lead no longer exists." };
  if (existing.status === "CONVERTED" && parsed.data.status !== "CONVERTED") {
    return { errors: { status: ["This lead was converted to a deal. Edit the deal instead."] }, values };
  }
  if (existing.status !== "CONVERTED" && parsed.data.status === "CONVERTED") {
    return { errors: { status: ['Use "Convert to deal" to convert a lead.'] }, values };
  }

  const data = parsed.data;
  const lead = await db.lead.update({
    where: { id },
    data: {
      ...data,
      disqualifyReason: data.status === "UNQUALIFIED" ? data.disqualifyReason : null,
      // Moving past "New" means someone has replied.
      respondedAt: existing.respondedAt ?? (data.status !== "NEW" ? new Date() : null),
    },
  });
  await audit({ actorId: user.id, action: "update", entity: "Lead", entityId: id, summary: lead.title });
  if (lead.ownerId && lead.ownerId !== existing.ownerId) after(() => notifyLeadAssigned(id, user.id));

  revalidateLead(id);
  redirect(`/leads/${id}`);
}

export async function markLeadResponded(id: string) {
  const user = await authorizeAction("lead:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const lead = await db.lead.findUnique({ where: { id }, select: { status: true, respondedAt: true, title: true } });
  if (!lead) return { message: "This lead no longer exists." };
  if (!lead.respondedAt) {
    await db.lead.update({
      where: { id },
      data: { respondedAt: new Date(), status: lead.status === "NEW" ? "CONTACTED" : lead.status },
    });
    await audit({ actorId: user.id, action: "update", entity: "Lead", entityId: id, summary: `${lead.title}: marked as replied` });
  }
  revalidateLead(id);
}

export async function setLeadStatus(id: string, status: Exclude<LeadStatus, "CONVERTED">, formData?: FormData) {
  const user = await authorizeAction("lead:update");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const lead = await db.lead.findUnique({ where: { id }, select: { status: true, respondedAt: true, title: true } });
  if (!lead) return { message: "This lead no longer exists." };
  if (lead.status === "CONVERTED") return { message: "This lead was already converted to a deal." };

  const reason = String(formData?.get("reason") ?? "").trim().slice(0, 500) || null;
  await db.lead.update({
    where: { id },
    data: {
      status,
      disqualifyReason: status === "UNQUALIFIED" ? reason : null,
      respondedAt: lead.respondedAt ?? (status !== "NEW" ? new Date() : null),
    },
  });
  await audit({ actorId: user.id, action: "update", entity: "Lead", entityId: id, summary: `${lead.title}: status → ${status}` });
  revalidateLead(id);
}

export async function deleteLead(id: string) {
  const user = await authorizeAction("lead:delete");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const lead = await db.lead.findUnique({ where: { id }, select: { title: true } });
  if (!lead) return { message: "This lead no longer exists." };

  await db.lead.delete({ where: { id } });
  await audit({ actorId: user.id, action: "delete", entity: "Lead", entityId: id, summary: lead.title });

  revalidateLead();
  redirect("/leads");
}

export async function convertLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("lead:convert");
  if (!user) return { message: FORBIDDEN_MESSAGE };

  const values = formToObject(formData);
  const parsed = convertLeadSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  const input = parsed.data;

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return { message: "This lead no longer exists." };
  if (lead.status === "CONVERTED") return { message: "This lead was already converted to a deal." };

  const stage = await db.pipelineStage.findUnique({ where: { id: input.stageId }, include: { pipeline: true } });
  if (!stage || stage.isWon || stage.isLost) return { errors: { stageId: ["Pick an open stage"] }, values };
  if (input.companyMode === "existing" && !(await companyExists(input.companyId))) {
    return { errors: { companyId: ["That company no longer exists."] }, values };
  }

  const deal = await db.$transaction(async (tx) => {
    let companyId: string | null = null;
    if (input.companyMode === "existing") companyId = input.companyId;
    if (input.companyMode === "new") {
      const company = await tx.company.create({
        data: { name: input.newCompanyName!, type: "PROSPECT", ownerId: input.ownerId ?? user.id, country: "Sri Lanka" },
      });
      companyId = company.id;
    }

    let contactId: string | null = null;
    if (input.createContact && lead.contactName) {
      const [firstName, ...rest] = lead.contactName.trim().split(/\s+/);
      const contact = await tx.contact.create({
        data: {
          firstName,
          lastName: rest.join(" ") || null,
          email: lead.email,
          phone: lead.phone,
          mobile: lead.whatsapp,
          language: lead.language,
          companyId,
          ownerId: input.ownerId ?? user.id,
        },
      });
      contactId = contact.id;
    }

    const created = await tx.deal.create({
      data: {
        title: input.title,
        value: input.value,
        currency: input.currency,
        serviceType: input.serviceType,
        pipelineId: stage.pipelineId,
        stageId: stage.id,
        expectedCloseDate: input.expectedCloseDate,
        ownerId: input.ownerId ?? user.id,
        companyId,
        contactId,
        leadId: lead.id,
        description: lead.description,
      },
    });

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        companyId,
        respondedAt: lead.respondedAt ?? new Date(),
      },
    });
    return created;
  });

  await audit({ actorId: user.id, action: "update", entity: "Lead", entityId: id, summary: `${lead.title}: converted to deal`, meta: { dealId: deal.id } });
  await audit({ actorId: user.id, action: "create", entity: "Deal", entityId: deal.id, summary: deal.title });

  revalidateLead(id);
  revalidatePath("/deals");
  redirect(`/deals/${deal.id}`);
}
