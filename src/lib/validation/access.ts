import { z } from "zod";
import { AccountOwner, ServiceCategory, SignInMethod, TwoStepMethod } from "@/generated/prisma/enums";
import { looksLikeSecret, secretMessage } from "@/lib/security/secret-guard";
import { optionalDate, optionalEmail, optionalText, optionalUrl, requiredText } from "./common";

/** Free text that must never contain a password, key or code. */
const noSecret = <T extends z.ZodType<string | null>>(field: T) =>
  field.superRefine((v, ctx) => {
    const what = looksLikeSecret(v);
    if (what) ctx.addIssue({ code: "custom", message: secretMessage(what) });
  });

export const accessSchema = z.object({
  googleEmail: optionalEmail,
  recoveryEmail: optionalEmail,
  recoveryPhone: noSecret(optionalText(40)),
  twoStep: z.enum(TwoStepMethod),
  secretsLocation: noSecret(optionalText(300)),
  envLocation: noSecret(optionalText(500)),
  notes: noSecret(optionalText(5000)),
});

export const serviceSchema = z.object({
  name: noSecret(requiredText("Service name", 120)),
  category: z.enum(ServiceCategory),
  url: optionalUrl.superRefine((v, ctx) => {
    if (v && /\/\/[^/\s]*:[^/\s]*@/.test(v)) ctx.addIssue({ code: "custom", message: "Remove the password from this address." });
  }),
  loginEmail: noSecret(optionalText(255)),
  signIn: z.enum(SignInMethod),
  owner: z.enum(AccountOwner),
  renewsAt: optionalDate,
  notes: noSecret(optionalText(2000)),
});
