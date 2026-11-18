import { z } from "zod";
import { ServiceType } from "@/generated/prisma/enums";
import { CURRENCIES } from "@/lib/crm-meta";
import { optionalDate, optionalEnum, optionalId, optionalMoney, optionalText, requiredText } from "./common";

export const dealSchema = z.object({
  title: requiredText("Deal name", 200),
  value: optionalMoney.transform((v) => v ?? 0),
  currency: z.enum(CURRENCIES),
  serviceType: optionalEnum(ServiceType),
  stageId: requiredText("Stage", 50),
  companyId: optionalId,
  contactId: optionalId,
  ownerId: optionalId,
  expectedCloseDate: optionalDate,
  description: optionalText(10_000),
});

export type DealInput = z.infer<typeof dealSchema>;

export const convertLeadSchema = z.object({
  companyMode: z.enum(["existing", "new", "none"]),
  companyId: optionalId,
  newCompanyName: optionalText(200),
  createContact: z.preprocess((v) => v === "on", z.boolean()),
  title: requiredText("Deal name", 200),
  value: optionalMoney.transform((v) => v ?? 0),
  currency: z.enum(CURRENCIES),
  serviceType: optionalEnum(ServiceType),
  stageId: requiredText("Stage", 50),
  expectedCloseDate: optionalDate,
  ownerId: optionalId,
}).superRefine((data, ctx) => {
  if (data.companyMode === "existing" && !data.companyId) {
    ctx.addIssue({ code: "custom", path: ["companyId"], message: "Pick a company" });
  }
  if (data.companyMode === "new" && !data.newCompanyName) {
    ctx.addIssue({ code: "custom", path: ["newCompanyName"], message: "Enter the company name" });
  }
});

export const lostReasonSchema = z.object({
  lostReason: requiredText("Reason", 500),
});
