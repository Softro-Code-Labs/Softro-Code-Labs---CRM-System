"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authorizeAction, FORBIDDEN_MESSAGE } from "@/lib/auth";
import { formToObject, type FormState } from "@/lib/form";
import { chatKind, CHAT_KIND_LABELS, postToChat } from "@/lib/integrations/chat";
import { emailConfigured, sendEmail } from "@/lib/integrations/email";
import { renderEmail } from "@/lib/integrations/email-template";
import { runDailyDigest } from "@/lib/integrations/digest";
import { appUrl } from "@/lib/integrations/app-url";

type Result = { ok?: boolean; message: string };

const chatSchema = z.object({
  chatWebhookUrl: z.string().trim().max(1000).optional().default(""),
  chatNotifyLeads: z.literal("on").optional(),
  chatNotifyWins: z.literal("on").optional(),
  chatNotifyTickets: z.literal("on").optional(),
});

export async function saveChatSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await authorizeAction("integration:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const values = formToObject(formData);
  const parsed = chatSchema.safeParse(values);
  if (!parsed.success) return { message: "Please check the form.", values };
  const { chatWebhookUrl, chatNotifyLeads, chatNotifyWins, chatNotifyTickets } = parsed.data;
  // A blank address keeps the saved one (it's never sent back to the browser).
  if (chatWebhookUrl && !chatKind(chatWebhookUrl)) {
    return { errors: { chatWebhookUrl: ["Paste an incoming webhook address from Slack, Google Chat, Discord or Microsoft Teams (it starts with https://)."] }, values };
  }
  const data = {
    ...(chatWebhookUrl && { chatWebhookUrl }),
    chatNotifyLeads: Boolean(chatNotifyLeads),
    chatNotifyWins: Boolean(chatNotifyWins),
    chatNotifyTickets: Boolean(chatNotifyTickets),
  };
  await db.orgSettings.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  await audit({
    actorId: user.id,
    action: "update",
    entity: "OrgSettings",
    summary: chatWebhookUrl ? `Connected team chat (${CHAT_KIND_LABELS[chatKind(chatWebhookUrl)!]})` : "Team chat notification settings",
  });
  revalidatePath("/settings/integrations");
  return { ok: true, message: "Saved." };
}

export async function removeChatWebhook(): Promise<Result> {
  const user = await authorizeAction("integration:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  await db.orgSettings.updateMany({ where: { id: "default" }, data: { chatWebhookUrl: null } });
  await audit({ actorId: user.id, action: "update", entity: "OrgSettings", summary: "Disconnected team chat" });
  revalidatePath("/settings/integrations");
  return { ok: true, message: "Team chat disconnected." };
}

export async function sendTestChat(): Promise<Result> {
  const user = await authorizeAction("integration:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  const s = await db.orgSettings.findUnique({ where: { id: "default" }, select: { chatWebhookUrl: true } });
  if (!s?.chatWebhookUrl) return { message: "Save a webhook address first." };
  const r = await postToChat(s.chatWebhookUrl, {
    title: "Softro CRM is connected ✅",
    lines: [`${user.name} sent this test. New website enquiries, deals won and urgent tickets will appear here.`],
    url: appUrl("/dashboard"),
  });
  return r.ok ? { ok: true, message: "Test message sent. Check your chat." } : { message: `Couldn't send: ${r.error}` };
}

export async function sendTestEmail(): Promise<Result> {
  const user = await authorizeAction("integration:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  if (!emailConfigured()) return { message: "Add RESEND_API_KEY and EMAIL_FROM in Vercel first, then redeploy." };
  const { html, text } = renderEmail({
    preheader: "Email from Softro CRM is working.",
    title: "Email is working ✅",
    intro: `${user.name}, this test came from Softro CRM through Resend. Assignment emails and morning summaries will look like this.`,
    button: { label: "Open Softro CRM", url: appUrl("/dashboard") },
  });
  const r = await sendEmail({ to: user.email, subject: "Softro CRM test email", html, text });
  return r.ok ? { ok: true, message: `Sent to ${user.email}.` } : { message: `Couldn't send: ${r.error}` };
}

export async function runDigestNow(): Promise<Result> {
  const user = await authorizeAction("integration:manage");
  if (!user) return { message: FORBIDDEN_MESSAGE };
  if (!emailConfigured()) return { message: "Email isn't set up yet." };
  const r = await runDailyDigest(new Date());
  if (r.skipped) return { message: "Today's summaries were already sent." };
  await audit({ actorId: user.id, action: "update", entity: "OrgSettings", summary: `Sent today's morning summaries by hand (${r.sent} sent)` });
  revalidatePath("/settings/integrations");
  return { ok: true, message: `Sent ${r.sent} ${r.sent === 1 ? "summary" : "summaries"}${r.failed ? `, ${r.failed} failed` : ""}. People with nothing due get no email.` };
}
