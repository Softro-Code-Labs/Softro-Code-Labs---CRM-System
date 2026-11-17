import { z } from "zod";
import { LeadSource, LeadStatus, PreferredLanguage, ServiceType } from "@/generated/prisma/enums";
import { CURRENCIES } from "@/lib/crm-meta";
import { optionalEmail, optionalEnum, optionalId, optionalMoney, optionalText, requiredText } from "./common";

export const leadSchema = z
  .object({
    title: requiredText("Title", 200),
    contactName: optionalText(150),
    companyName: optionalText(200),
    companyId: optionalId,
    email: optionalEmail,
    phone: optionalText(50),
    whatsapp: optionalText(50),
    language: z.enum(PreferredLanguage),
    source: z.enum(LeadSource),
    serviceType: optionalEnum(ServiceType),
    status: z.enum(LeadStatus).default("NEW"),
    estimatedValue: optionalMoney,
    currency: z.enum(CURRENCIES),
    description: optionalText(10_000),
    disqualifyReason: optionalText(500),
    ownerId: optionalId,
  })
  .refine((lead) => lead.email || lead.phone || lead.whatsapp, {
    message: "Add at least one way to reach them: email, phone or WhatsApp",
    path: ["email"],
  });

export type LeadInput = z.infer<typeof leadSchema>;

/** Body accepted from the website's "Start your project" form (POST /api/leads). */
export const websiteLeadSchema = z.object({
  name: z.string().trim().min(1).max(150),
  contact: z.string().trim().min(3).max(200), // "Email or WhatsApp number"
  service: z.string().trim().max(100).optional(),
  message: z.string().trim().max(10_000).optional(),
  language: z.enum(["en", "si", "ENGLISH", "SINHALA"]).optional(),
  page: z.string().trim().max(500).optional(),
  website: z.string().max(500).optional(), // honeypot: real people leave this empty
});
