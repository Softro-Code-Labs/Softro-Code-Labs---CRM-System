import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { AvatarError, avatarUrl, processAvatar } from "@/lib/avatar";

const photo = (w: number, h: number, format: "jpeg" | "png" = "jpeg") =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 194, g: 40, b: 58 } } })
    .withExif({ IFD0: { Make: "TestPhone", Model: "X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "6/1 55/1 0/1" } })
    [format]()
    .toBuffer();

describe("profile photos", () => {
  it("makes a 256×256 WebP from a phone-sized photo", async () => {
    const out = await processAvatar(await photo(1600, 1200));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([256, 256]);
    expect(out.byteLength).toBeLessThan(30_000);
  });

  it("removes hidden data like the camera and GPS location", async () => {
    const input = await photo(800, 800);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const meta = await sharp(await processAvatar(input)).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("accepts PNG too", async () => {
    expect((await sharp(await processAvatar(await photo(300, 500, "png"))).metadata()).width).toBe(256);
  });

  it("refuses files that aren't images, and very large uploads", async () => {
    await expect(processAvatar(Buffer.from("<svg onload=alert(1)></svg>"))).rejects.toBeInstanceOf(AvatarError);
    await expect(processAvatar(Buffer.from("%PDF-1.7 not a photo"))).rejects.toBeInstanceOf(AvatarError);
    await expect(processAvatar(Buffer.alloc(3 * 1024 * 1024))).rejects.toThrow(/too large/);
  });

  it("gives each upload its own URL so browsers can cache safely", () => {
    expect(avatarUrl({ id: "u1", avatarUpdatedAt: null })).toBeNull();
    const a = avatarUrl({ id: "u1", avatarUpdatedAt: new Date(1_700_000_000_000) });
    const b = avatarUrl({ id: "u1", avatarUpdatedAt: new Date(1_700_000_001_000) });
    expect(a).toMatch(/^\/avatars\/u1\?v=/);
    expect(a).not.toBe(b);
  });
});
