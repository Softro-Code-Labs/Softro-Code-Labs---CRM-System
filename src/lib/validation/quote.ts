import { z } from "zod";
import { ServiceType } from "@/generated/prisma/enums";
import { CURRENCIES } from "@/lib/crm-meta";
import { optionalDate, optionalEnum, optionalEmail, optionalId, optionalText, optionalUrl, requiredText } from "./common";

const percent = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? 0 : typeof v === "string" ? Number(v.replace(/[%\s]/g, "")) : v),
    z.number({ error: `${label}: enter a number` }).min(0, `${label} can't be negative`).max(100, `${label} can't be over 100%`),
  );

const money = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v),
    z.number({ error: `${label}: enter an amount` }).min(0, `${label} can't be negative`).max(999_999_999_999),
  );

export const quoteItemSchema = z.object({
  productId: z.string().max(50).nullish().transform((v) => v || null),
  title: z.string().trim().min(1, "Every line needs a name").max(200),
  description: z.string().trim().max(2000).nullish().transform((v) => v || null),
  quantity: z.preprocess(
    (v) => (typeof v === "string" ? Number(v) : v),
    z.number({ error: "Quantity: enter a number" }).positive("Quantity must be more than 0").max(1_000_000),
  ),
  unit: z.string().trim().min(1).max(30).default("project"),
  unitPrice: money("Price"),
  discountPercent: percent("Line discount"),
});

export const quoteSchema = z.object({
  title: requiredText("Quote title", 200),
  currency: z.enum(CURRENCIES),
  issueDate: optionalDate.refine((d) => d !== null, "Pick the quote date"),
  validUntil: optionalDate,
  dealId: optionalId,
  companyId: optionalId,
  contactId: optionalId,
  introduction: optionalText(5000),
  terms: optionalText(10_000),
  notes: optionalText(10_000),
  discountPercent: percent("Discount"),
  taxLabel: z.string().trim().min(1).max(20).default("VAT"),
  taxRate: percent("Tax rate"),
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Couldn't read the line items" });
        return z.NEVER;
      }
    })
    .pipe(z.array(quoteItemSchema).min(1, "Add at least one line").max(100, "Up to 100 lines per quote")),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export const productSchema = z.object({
  name: requiredText("Name", 150),
  description: optionalText(2000),
  unit: requiredText("Unit", 30),
  unitPrice: money("Price"),
  currency: z.enum(CURRENCIES),
  serviceType: optionalEnum(ServiceType),
});

export const orgSettingsSchema = z.object({
  companyName: requiredText("Company name", 150),
  address: optionalText(500),
  phone: optionalText(50),
  email: optionalEmail,
  website: optionalUrl,
  registrationNo: optionalText(60),
  vatNumber: optionalText(60),
  defaultTaxLabel: requiredText("Tax label", 20),
  defaultTaxRate: percent("Default tax rate"),
  defaultValidityDays: z.coerce.number({ error: "Enter a number of days" }).int().min(1).max(365),
  defaultTerms: optionalText(10_000),
  invoiceDueDays: z.coerce.number({ error: "Enter a number of days" }).int().min(0).max(365),
  invoiceTerms: optionalText(2000),
  bankDetails: optionalText(2000),
  quoteFooter: optionalText(500),
});
