import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238), as used by Google Authenticator,
 * Microsoft Authenticator, 1Password and Authy: SHA-1, 6 digits, 30-second steps.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random 160-bit secret, base32 encoded (32 characters). */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: string, counter: number, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString();
  return code.padStart(digits, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Checks a 6-digit code, allowing one step either side for clock drift.
 * Returns the matching step (store it to stop the same code being used twice), or null.
 */
export function verifyTotp(secret: string, code: string, opts: { now?: number; lastStep?: number | null; window?: number } = {}) {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(opts.now);
  const window = opts.window ?? 1;
  for (let s = step - window; s <= step + window; s++) {
    if (opts.lastStep != null && s <= opts.lastStep) continue;
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, Buffer.from(clean))) return s;
  }
  return null;
}

/** otpauth:// link for the QR code that authenticator apps scan. */
export function otpauthUrl(secret: string, account: string, issuer = "Softro CRM") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
