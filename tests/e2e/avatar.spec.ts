import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signIn, signOut, USERS } from "./fixtures";

test("a person adds a profile photo, the team sees it, and it can be removed", async ({ page }) => {
  const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg().toBuffer();

  await signIn(page, USERS.viewer);
  await page.goto("/settings/profile");
  await page.getByLabel("Profile photo").setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.getByText("Photo updated.")).toBeVisible();

  // The top bar shows the photo, served as a small WebP.
  const img = page.locator("header img").first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/avatars\/.+\?v=/);
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");

  // A file that isn't a photo is refused.
  await page.getByLabel("Profile photo").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not really a png") });
  await expect(page.getByText(/isn't a photo we can read|Use a JPG/)).toBeVisible();

  // Signed-out visitors can't fetch photos.
  await signOut(page);
  expect((await page.request.get(src!, { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300);

  // An admin sees it on the team list.
  await signIn(page, USERS.admin);
  await page.goto("/settings/users");
  await expect(page.locator(`img[src="${src}"]`)).toBeVisible();

  // The owner removes it.
  await signOut(page);
  await signIn(page, USERS.viewer);
  await page.goto("/settings/profile");
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Photo removed.")).toBeVisible();
  await expect(page.locator("header img")).toHaveCount(0);
});
