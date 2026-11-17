import "server-only";

/**
 * Posts short messages to a team chat through an incoming webhook.
 * Only these hosts are accepted, so the CRM can't be pointed at internal addresses.
 */
export type ChatKind = "slack" | "google-chat" | "discord" | "teams";

const HOSTS: { kind: ChatKind; test: (host: string) => boolean }[] = [
  { kind: "slack", test: (h) => h === "hooks.slack.com" },
  { kind: "google-chat", test: (h) => h === "chat.googleapis.com" },
  { kind: "discord", test: (h) => h === "discord.com" || h === "discordapp.com" },
  { kind: "teams", test: (h) => h.endsWith(".webhook.office.com") || h.endsWith(".logic.azure.com") || h.endsWith(".environment.api.powerplatform.com") },
];

export const CHAT_KIND_LABELS: Record<ChatKind, string> = { slack: "Slack", "google-chat": "Google Chat", discord: "Discord", teams: "Microsoft Teams" };

/** Returns the chat app for a webhook URL, or null if it isn't one we support. */
export function chatKind(url: string): ChatKind | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // Local mock servers are allowed only when explicitly switched on (automated tests).
  if (process.env.ALLOW_LOCAL_WEBHOOKS === "1" && u.hostname === "localhost") return (u.searchParams.get("kind") as ChatKind) ?? "slack";
  if (u.protocol !== "https:" || u.username || u.password) return null;
  return HOSTS.find((h) => h.test(u.hostname))?.kind ?? null;
}

/** A chat message: a headline, optional detail lines, and a link back to the CRM. */
export type ChatMessage = { title: string; lines?: string[]; url?: string; linkLabel?: string };

function payload(kind: ChatKind, m: ChatMessage) {
  const lines = m.lines?.filter(Boolean) ?? [];
  switch (kind) {
    case "slack":
      return { text: [`*${m.title}*`, ...lines, m.url ? `<${m.url}|${m.linkLabel ?? "Open in Softro CRM"}>` : ""].filter(Boolean).join("\n") };
    case "google-chat":
      return { text: [`*${m.title}*`, ...lines, m.url ? `<${m.url}|${m.linkLabel ?? "Open in Softro CRM"}>` : ""].filter(Boolean).join("\n") };
    case "discord":
      return { content: [`**${m.title}**`, ...lines, m.url ? `[${m.linkLabel ?? "Open in Softro CRM"}](${m.url})` : ""].filter(Boolean).join("\n"), allowed_mentions: { parse: [] } };
    case "teams":
      return {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [{ type: "TextBlock", text: m.title, weight: "Bolder", wrap: true }, ...lines.map((l) => ({ type: "TextBlock", text: l, wrap: true, spacing: "Small" }))],
              actions: m.url ? [{ type: "Action.OpenUrl", title: m.linkLabel ?? "Open in Softro CRM", url: m.url }] : [],
            },
          },
        ],
      };
  }
}

export async function postToChat(webhookUrl: string, message: ChatMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  const kind = chatKind(webhookUrl);
  if (!kind) return { ok: false, error: "That isn't a Slack, Google Chat, Discord or Teams webhook address." };
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload(kind, message)),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const error = `${CHAT_KIND_LABELS[kind]} replied ${res.status} ${res.statusText}`.trim();
      console.error(`[chat] failed: ${message.title}: ${error}`);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[chat] failed: ${message.title}: ${error}`);
    return { ok: false, error };
  }
}
