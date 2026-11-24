import "server-only";
import sharp from "sharp";

/**
 * Signatures are stored as a transparent PNG holding only the ink, recoloured to a dark-blue pen colour,
 * so a photo of a signature on paper sits cleanly on the document. Anything uploaded is decoded and redrawn.
 */
export const SIGNATURE_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_WORK = 1400; // longest side while cleaning
const OUT_HEIGHT = 180; // stored height in pixels (prints ~12 mm tall)
const INK = [0x1c, 0x2a, 0x5a]; // dark-blue pen
const ACCEPTED = new Set(["jpeg", "png", "webp", "heif", "avif"]);

export class SignatureError extends Error {}

export async function processSignature(input: Buffer) {
  if (input.byteLength > SIGNATURE_MAX_UPLOAD_BYTES) throw new SignatureError("That image is too large. Choose one under 3 MB.");
  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: 40_000_000 }).metadata()).format;
  } catch {
    throw new SignatureError("That file isn't an image we can read. Use a PNG or JPG.");
  }
  if (!format || !ACCEPTED.has(format)) throw new SignatureError("Use a PNG or JPG image.");

  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .flatten({ background: "#ffffff" }) // transparent PNGs (e.g. from the drawing pad) become ink on white
    .resize(MAX_WORK, MAX_WORK, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .normalise() // stretch contrast so pencil or a grey photo still reads as ink
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const out = Buffer.alloc(width * height * 4);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      // Dark pixels are ink, light ones are paper; a short ramp keeps the edges smooth.
      const alpha = v <= 100 ? 255 : v >= 190 ? 0 : Math.round(((190 - v) / 90) * 255);
      const o = (y * width + x) * 4;
      out[o] = INK[0];
      out[o + 1] = INK[1];
      out[o + 2] = INK[2];
      out[o + 3] = alpha;
      if (alpha > 60) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const inkW = maxX - minX + 1;
  const inkH = maxY - minY + 1;
  if (maxX < 0 || inkW < 20 || inkH < 8) throw new SignatureError("We couldn't find a signature in that image. Sign in dark ink on plain white paper.");
  if (inkW > width * 0.98 && inkH > height * 0.98) throw new SignatureError("That looks like a photo, not a signature. Sign on plain white paper, or draw it here.");

  const pad = Math.round(Math.max(inkW, inkH) * 0.03);
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  return sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: Math.min(width - left, inkW + 2 * pad), height: Math.min(height - top, inkH + 2 * pad) })
    .resize({ height: OUT_HEIGHT, width: OUT_HEIGHT * 5, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}
