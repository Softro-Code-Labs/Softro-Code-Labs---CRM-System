import { expect, test } from "@playwright/test";
import { signIn, signOut, USERS } from "./fixtures";

test("admins see plan usage on System health; others can't open it", async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto("/settings/system");
  await expect(page.getByRole("heading", { name: "Plan usage" })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Database storage" })).toBeVisible();
  await expect(page.getByText(/of 1\.0 GB/)).toBeVisible();
  await expect(page.getByText("What takes the space")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Vercel usage" })).toHaveAttribute("href", "https://vercel.com/dashboard/usage");

  await signOut(page);
  await signIn(page, USERS.viewer);
  await page.goto("/settings/system");
  await expect(page.getByRole("heading", { name: "Plan usage" })).toHaveCount(0);
});
