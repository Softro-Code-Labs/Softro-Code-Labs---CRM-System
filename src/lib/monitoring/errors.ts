import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/integrations/app-url";
import { postToChat } from "@/lib/integrations/chat";
import { emailConfigured, sendEmail } from "@/lib/integrations/email";
import { renderEmail } from "@/lib/integrations/email-template";

/**
 * Built-in error monitoring. Server errors are stored in ErrorEvent, grouped by a fingerprint
 * (same message + same place = one row with a count), and admins are alerted at most once an hour
 * per error, by team chat if connected, otherwise by email. Never throws.
 */
const ALERT_EVERY_MS = 60 * 60 * 1000;

export type ErrorInput = { error: unknown; path?: string | null; method?: string | null; digest?: string | null };

function normalize(message: string) {
  return message
    .replace(/\b[a-z0-9]{24,}\b/gi, "<id>") // cuids, tokens
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/"[^"]{40,}"/g, '"<text>"')
    .slice(0, 300);
}

/** "/deals/cmabc…/edit" → "/deals/[id]/edit", so the same error on different records groups together. */
export function routePattern(path: string | null | undefined) {
  if (!path) return null;
  return path.split("?")[0].replace(/\/c[a-z0-9]{20,}/gi, "/[id]").replace(/\/\d+(?=\/|$)/g, "/[n]").slice(0, 200);
}

export async function recordError({ error, path, method, digest }: ErrorInput) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message || "Unknown error"}`.slice(0, 1000);
    const stack = err.stack?.split("\n").slice(0, 15).join("\n").slice(0, 4000) ?? null;
    const firstFrame = err.stack?.split("\n").find((l) => l.trim().startsWith("at ")) ?? "";
    const route = routePattern(path);
    const fingerprint = createHash("sha1").update([normalize(message), firstFrame.replace(/:\d+:\d+\)?$/, ""), route].join("|")).digest("hex");
    const now = new Date();

    const row = await db.errorEvent.upsert({
      where: { fingerprint },
      create: { fingerprint, message, stack, path: route, method: method ?? null, digest: digest ?? null },
      update: { count: { increment: 1 }, lastSeenAt: now, resolvedAt: null, digest: digest ?? undefined, stack: stack ?? undefined },
    });

    if (row.alertedAt && now.getTime() - row.alertedAt.getTime() < ALERT_EVERY_MS) return;
    const claimed = await db.errorEvent.updateMany({
      where: { id: row.id, OR: [{ alertedAt: null }, { alertedAt: { lt: new Date(now.getTime() - ALERT_EVERY_MS) } }] },
      data: { alertedAt: now },
    });
    if (claimed.count) await alert(row.id, message, route, row.count);
  } catch (e) {
    console.error("[monitoring] could not record error:", e);
  }
}

async function alert(id: string, message: string, route: string | null, count: number) {
  const url = appUrl("/settings/system");
  const title = `⚠️ Softro CRM error${count > 1 ? ` (seen ${count}×)` : ""}`;
  const org = await db.orgSettings.findUnique({ where: { id: "default" }, select: { chatWebhookUrl: true } });
  if (org?.chatWebhookUrl) {
    const r = await postToChat(org.chatWebhookUrl, { title, lines: [message.slice(0, 300), route ? `Page: ${route}` : ""], url, linkLabel: "Open System page" });
    if (r.ok) return;
  }
  if (!emailConfigured()) return;
  const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { email: true } });
  if (!admins.length) return;
  const { html, text } = renderEmail({
    preheader: message.slice(0, 120),
    title,
    intro: "Someone hit an error in the CRM. Details are on the System page. You won't get another alert for this error for an hour.",
    rows: [["Error", message.slice(0, 300)], ...(route ? [["Page", route] as [string, string]] : []), ["Reference", id]],
    button: { label: "Open System page", url },
    footer: "Sent to Softro CRM admins when a new server error happens.",
  });
  await sendEmail({ to: admins.map((a) => a.email), subject: title, html, text });
}

/** Clears out errors that were marked fixed more than 90 days ago. */
export async function pruneErrors() {
  const { count } = await db.errorEvent.deleteMany({ where: { resolvedAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
  return count;
}
