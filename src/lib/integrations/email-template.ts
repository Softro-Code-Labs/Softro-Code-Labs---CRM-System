/** Plain, brand-consistent email layout that renders in Gmail, Outlook and phone mail apps. All text is escaped. */
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type EmailSection = { heading: string; items: { text: string; meta?: string; url?: string; urgent?: boolean }[] };

export function renderEmail(opts: { preheader: string; title: string; intro?: string; rows?: [string, string][]; sections?: EmailSection[]; button?: { label: string; url: string }; footer?: string }) {
  const e = escapeHtml;
  const rows = opts.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">${opts.rows
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#78716c;font-size:13px;width:38%;vertical-align:top">${e(k)}</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:500">${e(v)}</td></tr>`)
        .join("")}</table>`
    : "";
  const sections = (opts.sections ?? [])
    .map(
      (s) => `<h2 style="margin:24px 0 8px;font-size:14px;color:#1c1917">${e(s.heading)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${s.items
        .map(
          (i) => `<tr><td style="padding:8px 0;border-top:1px solid #e7e5e4;font-size:14px">${i.url ? `<a href="${e(i.url)}" style="color:#1c1917;text-decoration:none;font-weight:500">${e(i.text)}</a>` : e(i.text)}${
            i.meta ? `<div style="font-size:12px;color:${i.urgent ? "#dc2626" : "#78716c"};margin-top:2px">${e(i.meta)}</div>` : ""
          }</td></tr>`,
        )
        .join("")}</table>`,
    )
    .join("");
  const button = opts.button
    ? `<p style="margin:24px 0 0"><a href="${e(opts.button.url)}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${e(opts.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${e(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e7e5e4">
<tr><td style="padding:18px 24px;border-bottom:1px solid #e7e5e4;font-size:15px;font-weight:700;color:#1c1917"><span style="color:#b91c1c">Softro</span> CRM</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:18px;line-height:1.35;color:#1c1917">${e(opts.title)}</h1>
${opts.intro ? `<p style="margin:0;font-size:14px;line-height:1.55;color:#44403c">${e(opts.intro)}</p>` : ""}
${rows}${sections}${button}
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e7e5e4;font-size:12px;color:#a8a29e">${e(opts.footer ?? "You get these emails from Softro CRM. Change them under My profile → Notifications.")}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    opts.title,
    opts.intro ?? "",
    ...(opts.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(opts.sections ?? []).flatMap((s) => ["", s.heading.toUpperCase(), ...s.items.map((i) => `- ${i.text}${i.meta ? ` (${i.meta})` : ""}${i.url ? `\n  ${i.url}` : ""}`)]),
    opts.button ? `\n${opts.button.label}: ${opts.button.url}` : "",
    "",
    "--",
    opts.footer ?? "Softro CRM. Change these emails under My profile → Notifications.",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  return { html, text };
}
