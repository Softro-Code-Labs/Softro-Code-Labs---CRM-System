import { createHash, randomInt } from "node:crypto";

/** Ten one-time recovery codes like "7KQ4-M2XD", for when someone loses their phone. */
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 8 }, () => CHARS[randomInt(CHARS.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}
