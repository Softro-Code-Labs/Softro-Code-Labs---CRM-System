import { describe, expect, it } from "vitest";
import { open, seal } from "@/lib/security/secret-box";
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "@/lib/security/recovery-codes";

describe("secret box", () => {
  it("encrypts and decrypts, with a fresh IV each time", () => {
    const a = seal("JBSWY3DPEHPK3PXP");
    const b = seal("JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(open(a)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("detects tampering", () => {
    const sealed = seal("secret");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => open(parts.join("."))).toThrow();
  });
});

describe("recovery codes", () => {
  it("makes ten unique, readable codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("matches however the code is typed", () => {
    expect(normalizeRecoveryCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(hashRecoveryCode("abcd efgh")).toBe(hashRecoveryCode("ABCD-EFGH"));
    expect(hashRecoveryCode("ABCD-EFGH")).not.toBe(hashRecoveryCode("ABCD-EFGJ"));
  });
});
