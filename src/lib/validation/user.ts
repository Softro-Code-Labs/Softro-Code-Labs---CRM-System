import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { optionalText, requiredText } from "./common";

export const PASSWORD_MIN = 10;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Use at least one letter and one number");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "The passwords don't match" })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], message: "Choose a password you haven't used here before" });

export const userSchema = z.object({
  name: requiredText("Name", 120),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(255),
  role: z.enum(Role),
  jobTitle: optionalText(120),
  phone: optionalText(50),
});

export const profileSchema = z.object({
  name: requiredText("Name", 120),
  jobTitle: optionalText(120),
  phone: optionalText(50),
});
