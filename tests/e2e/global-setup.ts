import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import "dotenv/config";
import { USERS } from "./fixtures";

/** Creates (or resets) the test accounts and clears rate limits, so every run starts the same. */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must point at a TEST database for e2e tests");
  if (/neon\.tech|prod/i.test(url) && !process.env.E2E_ALLOW_REMOTE_DB) {
    throw new Error("Refusing to run e2e tests against what looks like a production database. Set E2E_ALLOW_REMOTE_DB=1 if you're sure.");
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const roles: Record<keyof typeof USERS, string> = { admin: "ADMIN", viewer: "VIEWER", twoFactor: "SALES", locked: "SALES" };
    for (const [key, u] of Object.entries(USERS) as [keyof typeof USERS, (typeof USERS)[keyof typeof USERS]][]) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        `INSERT INTO "User" (id, email, name, "passwordHash", role, "isActive", "mustChangePassword", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::"Role", true, false, now())
         ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = EXCLUDED.role, "isActive" = true,
           "mustChangePassword" = false, "failedLoginCount" = 0, "lockedUntil" = NULL,
           "totpSecret" = NULL, "totpEnabledAt" = NULL, "totpLastStep" = NULL, "recoveryCodeHashes" = '{}', "updatedAt" = now()`,
        [randomUUID(), u.email, u.name, hash, roles[key]],
      );
    }
    await client.query(`DELETE FROM "RateLimit"`);
    await client.query(`UPDATE "OrgSettings" SET "requireTwoFactor" = false`);
    const stages = await client.query(`SELECT count(*)::int AS n FROM "PipelineStage"`);
    if (!stages.rows[0].n) throw new Error("No pipeline stages: run `pnpm db:seed` on the test database first");
  } finally {
    await client.end();
  }
}
