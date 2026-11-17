import { z } from "zod";
import { ActivityPriority, ActivityType } from "@/generated/prisma/enums";
import { optionalId, optionalText, requiredText } from "./common";

/** The record an activity or note belongs to. Exactly one is set. */
const targetId = z.string().min(1).max(50).nullish().transform((v) => v ?? null);

export const targetSchema = z
  .object({
    leadId: targetId,
    dealId: targetId,
    companyId: targetId,
    contactId: targetId,
  })
  .refine((t) => [t.leadId, t.dealId, t.companyId, t.contactId].filter(Boolean).length === 1, {
    message: "Pick one record",
  });

export type Target = z.infer<typeof targetSchema>;

export const noteSchema = z.object({
  body: requiredText("Note", 10_000),
});

/** A <input type="datetime-local"> value, read as Sri Lanka time. */
const colomboDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time")
  .transform((v) => new Date(`${v}:00+05:30`));

/** Something that already happened: a call, WhatsApp chat, email or meeting. */
export const logActivitySchema = z.object({
  type: z.enum(ActivityType).refine((t) => t !== "TASK", "Pick what happened"),
  subject: requiredText("Summary", 200),
  description: optionalText(10_000),
});

/** Something to do later: a task, follow-up call, meeting… */
export const scheduleActivitySchema = z.object({
  type: z.enum(ActivityType),
  subject: requiredText("What needs doing", 200),
  description: optionalText(10_000),
  dueAt: colomboDateTime,
  priority: z.enum(ActivityPriority),
  assignedToId: optionalId,
});
