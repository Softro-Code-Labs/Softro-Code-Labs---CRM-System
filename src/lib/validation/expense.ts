import { z } from "zod";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { optionalDate, optionalText, requiredText } from "./common";

export const expenseSchema = z.object({
  date: optionalDate.refine((d) => d !== null, "Pick the date you paid"),
  category: z.enum(ExpenseCategory, { error: "Choose a category" }),
  description: requiredText("What it was for", 200),
  supplier: optionalText(120),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : v),
    z.number({ error: "Enter the amount in rupees" }).positive("Enter the amount in rupees").max(999_999_999_999),
  ),
  reference: optionalText(120),
  notes: optionalText(1000),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

/** Commission and tax rates (Settings → Commission & tax). */
const percent = (label: string) =>
  z.preprocess((v) => (typeof v === "string" ? Number(v.trim() || "x") : v), z.number({ error: `Enter ${label} as a number` }).min(0, "Can't be negative").max(100, "100% at most"));

export const financeRatesSchema = z.object({
  commissionSalesPercent: percent("the sales person's commission"),
  commissionManagerPercent: percent("the manager's commission"),
  commissionLeaderPercent: percent("the Manager or Admin commission"),
  incomeTaxPercent: percent("the income tax rate"),
  exportIncomeTaxPercent: percent("the export income tax rate"),
});
