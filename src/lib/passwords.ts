import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// No 0/O/1/l/I so it's easy to read out over the phone or WhatsApp.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** A one-time password like "Softro-k7Mq-9xTe-Rw4p". The user must change it after signing in. */
export function generateTemporaryPassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `Softro-${group()}-${group()}-${group()}`;
}
