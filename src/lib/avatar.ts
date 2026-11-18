import "server-only";
import sharp from "sharp";

/** Profile photos are stored as 256×256 WebP. Anything uploaded is decoded and re-encoded, so only clean pixels are kept. */
export const AVATAR_SIZE = 256;
export const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // after the browser's own resize, real uploads are ~100–300 KB
const ACCEPTED = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);

export class AvatarError extends Error {}

export async function processAvatar(input: Buffer) {
  if (input.byteLength > AVATAR_MAX_UPLOAD_BYTES) throw new AvatarError("That photo is too large. Choose one under 2 MB.");
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    // limitInputPixels guards against "decompression bomb" images.
    meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new AvatarError("That file isn't a photo we can read. Use a JPG, PNG or WebP image.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new AvatarError("Use a JPG, PNG or WebP image.");
  return sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate() // apply the phone's orientation, then drop all metadata (EXIF, GPS)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
}

/** URL of a person's photo, or null. The version in the URL changes with each upload, so browsers can cache it for good. */
export function avatarUrl(user: { id: string; avatarUpdatedAt: Date | null }) {
  return user.avatarUpdatedAt ? `/avatars/${user.id}?v=${user.avatarUpdatedAt.getTime().toString(36)}` : null;
}
