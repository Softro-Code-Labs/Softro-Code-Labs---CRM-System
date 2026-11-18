import { z } from "zod";
import { BillingCycle, ContractType, TicketChannel, TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { CURRENCIES } from "@/lib/crm-meta";
import { optionalDate, optionalId, optionalMoney, optionalText, requiredText } from "./common";

const optionalInt = (label: string, max: number) =>
  z
    .preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number({ error: `${label}: enter a whole number` }).int(`${label}: enter a whole number`).min(0).max(max).optional())
    .transform((v) => v ?? null);

export const contractSchema = z
  .object({
    title: requiredText("Contract name", 200),
    type: z.enum(ContractType),
    companyId: requiredText("Client company", 50),
    contactId: optionalId,
    dealId: optionalId,
    ownerId: optionalId,
    startDate: optionalDate.refine((d) => d !== null, "Pick a start date"),
    endDate: optionalDate,
    billingCycle: z.enum(BillingCycle),
    amount: optionalMoney.transform((v) => v ?? 0),
    currency: z.enum(CURRENCIES),
    autoRenew: z.preprocess((v) => v === "on", z.boolean()),
    renewalNoticeDays: optionalInt("Reminder days", 365).transform((v) => v ?? 30),
    responseTimeHours: optionalInt("Response time", 720),
    includedHours: optionalMoney,
    scope: optionalText(10_000),
  })
  .refine((c) => !c.endDate || !c.startDate || c.endDate > c.startDate, { path: ["endDate"], message: "End date must be after the start date" });

export type ContractInput = z.infer<typeof contractSchema>;

export const ticketSchema = z.object({
  subject: requiredText("Subject", 200),
  description: optionalText(10_000),
  priority: z.enum(TicketPriority),
  channel: z.enum(TicketChannel),
  status: z.enum(TicketStatus).default("OPEN"),
  companyId: optionalId,
  contactId: optionalId,
  contractId: optionalId,
  assignedToId: optionalId,
});

export const ticketCommentSchema = z.object({
  body: requiredText("Message", 10_000),
  isClientReply: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});
