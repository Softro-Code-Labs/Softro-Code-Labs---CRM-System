import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getAccessForDeal } from "@/lib/project-access";
import { getOrgSettings } from "@/lib/queries/org";
import { LIMITS, rateLimit } from "@/lib/security/rate-limit";
import {
  renderLoginSheetPdf,
  type LoginSheet,
} from "@/lib/pdf/login-sheet-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign-in methods that use their own password, so the sheet asks for one. */
const NEEDS_PASSWORD = new Set(["PASSWORD_IN_GOOGLE", "OTHER"]);

const secret = z
  .string()
  .max(200, "Too long")
  .transform((v) => v.trim() || null);
const schema = z.object({
  pdfPassword: z
    .string()
    .min(8, "Use at least 8 characters for the PDF password.")
    .max(64, "Use at most 64 characters."),
  gmailPassword: secret.optional(),
  backupCodes: z
    .string()
    .max(1000, "Too long")
    .transform((v) => v.trim() || null)
    .optional(),
});

function fail(message: string, status = 400) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * POST /deals/:id/access/login-sheet
 * Makes the project's login sheet from passwords typed in just now, and returns it locked with a PDF password.
 * Nothing typed here is saved, logged or audited: only the fact that a sheet was made.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("Please sign in again.", 401);
  if (!can(user.role, "access:manage"))
    return fail("You don't have access to this.", 403);

  // Only from the CRM's own pages.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host)
    return fail("Request refused.", 403);

  const limit = await rateLimit(
    `login-sheet:${user.id}`,
    LIMITS.loginSheetsPerUser.limit,
    LIMITS.loginSheetsPerUser.windowSeconds,
  );
  if (!limit.ok)
    return fail(
      "Too many login sheets in the last hour. Try again later.",
      429,
    );

  const { id } = await params;
  const [access, org, form] = await Promise.all([
    getAccessForDeal(id),
    getOrgSettings(),
    request.formData(),
  ]);
  if (!access) return fail("Save the project account first.", 404);

  const fields = Object.fromEntries(
    [...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
  const parsed = schema.safeParse(fields);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Check the form.");

  const services: LoginSheet["services"] = [];
  for (const svc of access.services) {
    let password: string | null = null;
    if (NEEDS_PASSWORD.has(svc.signIn)) {
      const p = secret.safeParse(fields[`pw_${svc.id}`] ?? "");
      if (!p.success) return fail(`The password for ${svc.name} is too long.`);
      password = p.data;
    }
    services.push({
      name: svc.name,
      url: svc.url,
      loginEmail: svc.loginEmail,
      signIn: svc.signIn,
      password,
    });
  }

  const sheet: LoginSheet = {
    project: access.deal.title,
    client: access.deal.company?.name ?? null,
    issuedBy: user.name,
    account: access.googleEmail
      ? {
          email: access.googleEmail,
          twoStep: access.twoStep,
          password: parsed.data.gmailPassword ?? null,
          backupCodes: parsed.data.backupCodes ?? null,
        }
      : null,
    services,
  };
  const included =
    services.filter((x) => x.password).length +
    (sheet.account?.password ? 1 : 0);
  if (!included && !sheet.account?.backupCodes)
    return fail("Type at least one password to include.");

  const pdf = await renderLoginSheetPdf(sheet, org, parsed.data.pdfPassword);
  await audit({
    actorId: user.id,
    action: "create",
    entity: "ProjectAccess",
    entityId: access.dealId,
    summary: `Login sheet made for ${access.deal.title} (${included} password${included === 1 ? "" : "s"}; not stored)`,
  });

  const filename =
    `Login sheet ${access.deal.company?.name ?? access.deal.title}`
      .replace(/[^\w\s.-]/g, "")
      .replace(/\s+/g, " ")
      .trim() + ".pdf";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
