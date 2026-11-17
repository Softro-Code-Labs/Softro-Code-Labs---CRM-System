import { describe, expect, it } from "vitest";
import { chatKind } from "@/lib/integrations/chat";
import { escapeHtml, renderEmail } from "@/lib/integrations/email-template";
import { foldIcsLine } from "@/lib/integrations/calendar";
import { resolvePeriod, toCsv, monthBuckets } from "@/lib/reports";
import { routePattern } from "@/lib/monitoring/errors";
import { envChecks } from "@/lib/env";
import { clientIp } from "@/lib/security/client-ip";

describe("team chat webhooks", () => {
  it("recognises the supported apps", () => {
    expect(chatKind("https://hooks.slack.com/services/T0/B0/xyz")).toBe("slack");
    expect(chatKind("https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t")).toBe("google-chat");
    expect(chatKind("https://discord.com/api/webhooks/1/abc")).toBe("discord");
    expect(chatKind("https://softro.webhook.office.com/webhookb2/abc")).toBe("teams");
  });
  it("refuses anything else, so the CRM can't be pointed at internal addresses", () => {
    for (const url of [
      "http://hooks.slack.com/services/x",
      "https://hooks.slack.com.evil.com/x",
      "https://evil.com/?u=hooks.slack.com",
      "https://user:pass@hooks.slack.com/x",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost:4010/chat",
      "not a url",
    ]) expect(chatKind(url), url).toBeNull();
  });
});

describe("emails", () => {
  it("escapes everything that came from a form", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
    const { html, text } = renderEmail({ preheader: "p", title: "Lead <b>Nimal</b>", rows: [["Message", "<img src=x onerror=alert(1)>"]], button: { label: "Open", url: "https://crm.example/leads/1?a=1&b=2" } });
    expect(html).not.toContain("<b>Nimal</b>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("a=1&amp;b=2");
    expect(text).toContain("Lead <b>Nimal</b>");
  });
});

describe("calendar feed", () => {
  it("folds long lines at 75 bytes without splitting Sinhala characters", () => {
    const line = `SUMMARY:${"ශ්‍රී ලංකා ".repeat(12)}`;
    const folded = foldIcsLine(line);
    for (const part of folded.split("\r\n")) expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });
});

describe("reports", () => {
  const now = new Date("2026-11-17T12:00:00Z"); // Tue 17 Nov, Colombo
  it("works out periods in Sri Lanka time", () => {
    const p = resolvePeriod({ period: "this-month" }, now);
    expect(p.from.toISOString()).toBe("2026-10-31T18:30:00.000Z"); // 1 Nov 00:00 Colombo
    expect(p.to.toISOString()).toBe("2026-11-30T18:30:00.000Z");
    expect(resolvePeriod({ period: "last-quarter" }, now).from.toISOString()).toBe("2026-06-30T18:30:00.000Z");
    expect(monthBuckets(resolvePeriod({}, now))).toHaveLength(12);
  });
  it("accepts custom dates and ignores nonsense", () => {
    const p = resolvePeriod({ from: "2026-01-01", to: "2026-01-31" }, now);
    expect(p.key).toBe("custom");
    expect(p.to.getTime() - p.from.getTime()).toBe(31 * 86_400_000);
    expect(resolvePeriod({ from: "2026-02-01", to: "2026-01-01" }, now).key).toBe("last-12");
    expect(resolvePeriod({ period: "drop table" }, now).key).toBe("last-12");
  });
  it("writes CSV that Excel opens safely", () => {
    const csv = toCsv(["Name", "Note"], [["=HYPERLINK(\"http://x\")", 'He said "hi", then left'], ["-5", 3], [null, undefined]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://x"")","He said ""hi"", then left"`);
    expect(lines[2]).toBe("'-5,3");
    expect(lines[3]).toBe(",");
  });
});

describe("monitoring and config", () => {
  it("groups errors by page pattern", () => {
    expect(routePattern("/deals/cmwkctfkn0002b37dd521pblp/edit?x=1")).toBe("/deals/[id]/edit");
    expect(routePattern(undefined)).toBeNull();
  });
  it("flags weak or missing settings", () => {
    const checks = envChecks({ DATABASE_URL: "postgresql://x", SESSION_SECRET: "short" } as unknown as NodeJS.ProcessEnv);
    expect(checks.find((c) => c.name === "DATABASE_URL")?.ok).toBe(true);
    expect(checks.find((c) => c.name === "SESSION_SECRET")?.ok).toBe(false);
  });
  it("reads the visitor's address from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
