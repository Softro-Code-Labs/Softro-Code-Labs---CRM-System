import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** Optional free text: "" becomes null so the database stores NULL. */
export const optionalText = (max = 255) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional()).transform((v) => v ?? null);

export const requiredText = (label: string, max = 255) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

export const optionalEmail = z
  .preprocess(emptyToUndefined, z.email("Enter a valid email address").max(255).optional())
  .transform((v) => v?.toLowerCase() ?? null);

export const optionalUrl = z
  .preprocess((value) => {
    const v = emptyToUndefined(value);
    if (typeof v === "string" && !/^https?:\/\//i.test(v)) return `https://${v.trim()}`;
    return v;
  }, z.url("Enter a valid web address").max(500).optional())
  .transform((v) => v ?? null);

export const optionalId = z
  .preprocess(emptyToUndefined, z.string().max(50).optional())
  .transform((v) => v ?? null);

/** Money typed by a person: "1,250,000" or "1250000.50". Empty → null. */
export const optionalMoney = z
  .preprocess((value) => {
    if (typeof value !== "string") return value;
    const cleaned = value.replace(/[,\s]/g, "");
    return cleaned === "" ? undefined : Number(cleaned);
  }, z.number({ error: "Enter an amount, e.g. 250000" }).min(0, "Amount can't be negative").max(999_999_999_999).optional())
  .transform((v) => v ?? null);

/** A yyyy-mm-dd date from <input type="date">. Empty → null. */
export const optionalDate = z
  .preprocess(emptyToUndefined, z.iso.date("Enter a valid date").optional())
  .transform((v) => (v ? new Date(`${v}T00:00:00+05:30`) : null));

export const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional()).transform((v) => v ?? null);
