/**
 * Checks configuration when the server starts, so a missing or weak setting is a clear message
 * in the Vercel logs instead of a confusing failure later.
 */
type Check = { name: string; ok: boolean; required: boolean; hint: string };

export function envChecks(env: NodeJS.ProcessEnv = process.env): Check[] {
  const len = (k: string) => env[k]?.length ?? 0;
  return [
    { name: "DATABASE_URL", ok: /^postgres(ql)?:\/\//.test(env.DATABASE_URL ?? ""), required: true, hint: "PostgreSQL connection string" },
    { name: "SESSION_SECRET", ok: len("SESSION_SECRET") >= 32, required: true, hint: "48+ random characters" },
    { name: "APP_URL", ok: /^https?:\/\//.test(env.APP_URL ?? "") || Boolean(env.VERCEL_PROJECT_PRODUCTION_URL), required: false, hint: "public address, for links in emails" },
    { name: "WEBSITE_LEAD_API_KEY", ok: len("WEBSITE_LEAD_API_KEY") >= 24, required: false, hint: "24+ characters, same as the website" },
    { name: "RESEND_API_KEY", ok: len("RESEND_API_KEY") > 0 && Boolean(env.EMAIL_FROM), required: false, hint: "with EMAIL_FROM, for emails" },
    { name: "CRON_SECRET", ok: len("CRON_SECRET") >= 16, required: false, hint: "16+ characters, for the morning summary" },
    { name: "NEON_API_KEY", ok: len("NEON_API_KEY") > 0 && Boolean(env.NEON_PROJECT_ID), required: false, hint: "with NEON_PROJECT_ID, for plan usage in System health" },
  ];
}

export function validateEnv() {
  const checks = envChecks();
  const missing = checks.filter((c) => c.required && !c.ok);
  const optional = checks.filter((c) => !c.required && !c.ok);
  if (optional.length) console.warn(`[config] Optional settings not set: ${optional.map((c) => `${c.name} (${c.hint})`).join("; ")}`);
  if (missing.length) {
    const msg = `[config] Required settings missing or too weak: ${missing.map((c) => `${c.name} (${c.hint})`).join("; ")}`;
    console.error(msg);
    // Refuse to start in production rather than run insecurely (e.g. with a short session secret).
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") throw new Error(msg);
  }
}
