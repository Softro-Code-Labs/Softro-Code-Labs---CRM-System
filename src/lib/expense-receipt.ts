import "server-only";
import sharp from "sharp";

/** Bills and receipts for expenses: a photo (stored as a re-encoded JPEG, no EXIF or location) or a PDF. */
export const RECEIPT_MAX_BYTES = 2.5 * 1024 * 1024;
const IMAGES = new Set(["jpeg", "png", "webp", "heif", "avif"]);

export class ReceiptError extends Error {}

export async function processReceipt(file: File): Promise<{ data: Uint8Array<ArrayBuffer>; type: string; name: string }> {
  if (file.size > RECEIPT_MAX_BYTES) throw new ReceiptError("That file is too large. Use a photo or PDF under 2.5 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  const base = (file.name || "receipt").replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "").slice(0, 80) || "receipt";

  if (input.subarray(0, 5).toString("latin1") === "%PDF-") return { data: new Uint8Array(input), type: "application/pdf", name: `${base}.pdf` };

  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: 60_000_000 }).metadata()).format;
  } catch {
    throw new ReceiptError("That file isn't a photo or PDF we can read. Use a JPG, PNG or PDF.");
  }
  if (!format || !IMAGES.has(format)) throw new ReceiptError("Use a JPG, PNG or PDF.");
  const data = await sharp(input, { limitInputPixels: 60_000_000, animated: false })
    .rotate() // apply the phone's orientation, then drop all metadata
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return { data: new Uint8Array(data), type: "image/jpeg", name: `${base}.jpg` };
}
