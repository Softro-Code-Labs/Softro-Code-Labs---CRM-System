import { describe, expect, it } from "vitest";
import { looksLikeSecret } from "@/lib/security/secret-guard";

describe("secret guard", () => {
  it("spots common secrets", () => {
    const secrets = [
      "sk_live_51Hx0aBcDeFgHiJkLmNoP",
      "AKIAIOSFODNN7EXAMPLE",
      "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
      "postgresql://neondb_owner:npg_Ab12Cd34@ep-cool-1.neon.tech/neondb",
      "password: Galle@2026!",
      "API key = 9f8e7d6c",
      "8215 3301\n4419 0072\n6620 1188\n9031 4456",
      "JBSW Y3DP EHPK 3PXP JBSW Y3DP",
      "re_Hk2LmN9pQ4rS7tV1wX3yZ5aB",
      "-----BEGIN PRIVATE KEY-----",
      "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N",
      "k8Fz2QwErTyUiOpAsDfGhJkLzXcVbNm1234",
    ];
    for (const s of secrets) expect(looksLikeSecret(s), s).not.toBeNull();
  });

  it("lets ordinary access notes through", () => {
    const fine = [
      "Google Password Manager (Softro admin) → Galle Hardware",
      "Vercel project settings; copy in Drive /env (version history)",
      "https://vercel.com/softro/galle-hardware",
      "projects+galle@softrocodelabs.com",
      "Password is in Google Password Manager, not here",
      "Renew the domain before March; client pays",
      "Client's Stripe account, they added us as a developer",
      "077 123 4567",
      "",
      null,
    ];
    for (const s of fine) expect(looksLikeSecret(s), String(s)).toBeNull();
  });
});
