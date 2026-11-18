import { z } from "zod";
import { PreferredLanguage } from "@/generated/prisma/enums";
import { optionalEmail, optionalId, optionalText, optionalUrl, requiredText } from "./common";

export const contactSchema = z.object({
  firstName: requiredText("First name", 100),
  lastName: optionalText(100),
  email: optionalEmail,
  phone: optionalText(50),
  mobile: optionalText(50),
  jobTitle: optionalText(120),
  department: optionalText(120),
  linkedinUrl: optionalUrl,
  language: z.enum(PreferredLanguage).default("ENGLISH"),
  isPrimary: z
    .preprocess((v) => v === "on" || v === "true", z.boolean())
    .default(false),
  companyId: optionalId,
  ownerId: optionalId,
});

export type ContactInput = z.infer<typeof contactSchema>;
