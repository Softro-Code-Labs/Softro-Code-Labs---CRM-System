import { createHash, timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyNewWebsiteLead } from "@/lib/integrations/notify";
import { websiteLeadSchema } from "@/lib/validation/lead";
import { addWorkingDays, REPLY_WITHIN_WORKING_DAYS } from "@/lib/working-days";
import { SERVICE_TYPE_LABELS } from "@/lib/crm-meta";
import type { ServiceType } from "@/generated/prisma/enums";

/**
 * POST /api/leads — receives the "Start your project" form from softrocodelabs.com.
 * Call it from the website's SERVER (route handler / server action), never from the
 * browser, so the API key stays secret. See README → "Website form".
 */

// The website form's options → our service types.
const WEBSITE_SERVICE_MAP: Record<string, ServiceType> = {
  "website or web app": "WEBSITE_WEB_APP",
  "mobile app": "MOBILE_APP",
  "online store": "ONLINE_STORE",
  "business system": "BUSINESS_SYSTEM",
  "ai or automation": "AI_AUTOMATION",
  "custom software": "CUSTOM_SOFTWARE",
  "not sure yet": "NOT_SURE",
};

function toServiceType(value: string | undefined): ServiceType | null {
  if (!value) return null;
  if (value in SERVICE_TYPE_LABELS) return value as ServiceType;
  return WEBSITE_SERVICE_MAP[value.trim().toLowerCase()] ?? null;
}

function keyMatches(given: string | null) {
  const expected = process.env.WEBSITE_LEAD_API_KEY;
  if (!expected || expected.length < 24 || !given) return false;
  // Compare hashes so the check takes the same time whatever the input.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Simple per-IP limit: 10 submissions per 10 minutes per server instance.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

export async function POST(request: NextRequest) {
  if (!keyMatches(request.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The website forwards the visitor's IP so the limit applies per visitor.
  const ip = request.headers.get("x-visitor-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = websiteLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  const input = parsed.data;

  // Honeypot filled in → almost certainly a bot. Pretend it worked.
  if (input.website) return NextResponse.json({ ok: true }, { status: 201 });

  const isEmail = input.contact.includes("@");
  const serviceType = toServiceType(input.service);
  const language = input.language === "si" || input.language === "SINHALA" ? "SINHALA" : "ENGLISH";
  const ownerEmail = process.env.WEBSITE_LEAD_OWNER_EMAIL?.toLowerCase();
  const owner = ownerEmail ? await db.user.findUnique({ where: { email: ownerEmail }, select: { id: true, isActive: true } }) : null;

  const serviceLabel = serviceType && serviceType !== "NOT_SURE" ? SERVICE_TYPE_LABELS[serviceType].replace(/\s*\(.*\)$/, "") : "Project";
  const now = new Date();
  const lead = await db.lead.create({
    data: {
      title: `${serviceLabel} enquiry from ${input.name}`.slice(0, 200),
      contactName: input.name,
      email: isEmail ? input.contact.toLowerCase() : null,
      whatsapp: isEmail ? null : input.contact,
      language,
      source: "WEBSITE_FORM",
      serviceType,
      description: [input.message, input.page && `Sent from: ${input.page}`].filter(Boolean).join("\n\n") || null,
      currency: process.env.DEFAULT_CURRENCY ?? "LKR",
      ownerId: owner?.isActive ? owner.id : null,
      respondBy: addWorkingDays(now, REPLY_WITHIN_WORKING_DAYS),
    },
    select: { id: true, title: true },
  });
  await audit({ actorId: null, action: "create", entity: "Lead", entityId: lead.id, summary: `${lead.title} (website form)` });
  // Email the owner and post to team chat after the response is sent, so the website form stays fast.
  after(() => notifyNewWebsiteLead(lead.id));

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
