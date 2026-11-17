import "server-only";

/**
 * Sends email through Resend (https://resend.com), the same service the Softro website uses.
 * Needs RESEND_API_KEY and EMAIL_FROM, e.g. "Softro CRM <crm@softrocodelabs.com>" on a domain verified in Resend.
 * Without them, emails are skipped (and logged), so local development works without an account.
 */
export type EmailMessage = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string };
export type SendResult = { ok: true; id?: string } | { ok: false; skipped?: boolean; error: string };

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!emailConfigured()) {
    console.info(`[email] skipped (not configured): "${message.subject}" → ${[message.to].flat().join(", ")}`);
    return { ok: false, skipped: true, error: "Email isn't set up. Add RESEND_API_KEY and EMAIL_FROM." };
  }
  try {
    const res = await fetch(`${process.env.RESEND_API_URL ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to].flat(),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo && { reply_to: message.replyTo }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      const error = `Resend ${res.status}: ${body.message ?? res.statusText}`;
      console.error(`[email] failed: "${message.subject}": ${error}`);
      return { ok: false, error };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[email] failed: "${message.subject}": ${error}`);
    return { ok: false, error };
  }
}
