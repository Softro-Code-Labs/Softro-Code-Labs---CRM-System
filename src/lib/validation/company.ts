import { z } from "zod";
import { CompanyType } from "@/generated/prisma/enums";
import { optionalEmail, optionalId, optionalText, optionalUrl, requiredText } from "./common";

export const EMPLOYEE_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

export const companySchema = z.object({
  name: requiredText("Company name", 200),
  type: z.enum(CompanyType),
  industry: optionalText(120),
  website: optionalUrl,
  email: optionalEmail,
  phone: optionalText(50),
  employeeSize: z
    .preprocess((v) => (v === "" ? undefined : v), z.enum(EMPLOYEE_SIZES).optional())
    .transform((v) => v ?? null),
  addressLine: optionalText(255),
  city: optionalText(100),
  country: optionalText(100),
  taxId: optionalText(60),
  description: optionalText(5000),
  ownerId: optionalId,
});

export type CompanyInput = z.infer<typeof companySchema>;
