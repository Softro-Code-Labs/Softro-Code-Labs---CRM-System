import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, otpauthUrl, verifyTotp, STEP_SECONDS } from "@/lib/security/totp";

// RFC 6238 appendix B: ASCII "12345678901234567890" with SHA-1.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors (8 digits)", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    const at = (seconds: number) => hotp(RFC_SECRET, Math.floor(seconds / STEP_SECONDS), 8);
    expect(at(59)).toBe("94287082");
    expect(at(1111111109)).toBe("07081804");
    expect(at(1234567890)).toBe("89005924");
    expect(at(2000000000)).toBe("69279037");
  });

  it("round-trips base32 and makes 32-character secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Decode("gezd gnbv-gy3t")).toEqual(base32Decode("GEZDGNBVGY3T"));
  });

  it("accepts the current code and one step of clock drift, nothing further", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / STEP_SECONDS);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "123 456".replace("123 456", hotp(RFC_SECRET, step).replace(/(\d{3})/, "$1 ")), { now })).toBe(step);
  });

  it("refuses a code that was already used (replay)", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / STEP_SECONDS);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), { now, lastStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), { now, lastStep: step - 1 })).toBeNull();
  });

  it("rejects malformed codes", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5"]) expect(verifyTotp(RFC_SECRET, bad)).toBeNull();
  });

  it("builds an otpauth link authenticator apps understand", () => {
    const url = new URL(otpauthUrl("ABC", "admin@softrocodelabs.com"));
    expect(url.protocol).toBe("otpauth:");
    expect(url.host).toBe("totp");
    expect(decodeURIComponent(url.pathname)).toBe("/Softro CRM:admin@softrocodelabs.com");
    expect(url.searchParams.get("issuer")).toBe("Softro CRM");
    expect(url.searchParams.get("secret")).toBe("ABC");
  });
});
