import { z } from "zod";
import { PaymentMethod } from "@/generated/prisma/enums";
import { optionalDate, optionalId, optionalText } from "./common";
import { quoteSchema } from "./quote";

export const invoiceSchema = quoteSchema.omit({ validUntil: true, introduction: true, issueDate: true }).extend({
  issueDate: optionalDate.refine((d) => d !== null, "Pick the invoice date"),
  dueDate: optionalDate,
  contractId: optionalId,
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v),
    z.number({ error: "Enter the amount received" }).positive("Enter the amount received").max(999_999_999_999),
  ),
  method: z.enum(PaymentMethod),
  paidAt: optionalDate.refine((d) => d !== null, "Pick the date it was received"),
  reference: optionalText(120),
  notes: optionalText(1000),
});
