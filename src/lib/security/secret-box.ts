import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for small secrets stored in the database (2FA secrets).
 * The key comes from ENCRYPTION_KEY, or is derived from SESSION_SECRET when that isn't set.
 * Changing the key means everyone has to set up two-step sign-in again.
 */
function key() {
  const source = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!source || source.length < 32) throw new Error("ENCRYPTION_KEY or SESSION_SECRET (32+ characters) is required");
  return Buffer.from(hkdfSync("sha256", source, "softro-crm", "secret-box/v1", 32));
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function open(sealed: string) {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown sealed format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
