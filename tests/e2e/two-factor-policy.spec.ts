import { expect, test } from "@playwright/test";
import { signIn, sql, USERS } from "./fixtures";

test.describe("company rule: admins and managers must use two-step sign-in", () => {
  test.beforeAll(async () => {
    await sql(`INSERT INTO "OrgSettings" (id, "updatedAt") VALUES ('default', now()) ON CONFLICT (id) DO NOTHING`);
    await sql(`UPDATE "OrgSettings" SET "requireTwoFactor" = true`);
  });
  test.afterAll(async () => {
    await sql(`UPDATE "OrgSettings" SET "requireTwoFactor" = false`);
  });

  test("an admin without it is sent to set it up before anything else", async ({ page }) => {
    await signIn(page, USERS.admin, /\/(dashboard|setup-two-factor)/);
    await page.goto("/deals");
    await expect(page).toHaveURL(/\/setup-two-factor/);
    await expect(page.getByRole("heading", { name: "Set up two-step sign-in" })).toBeVisible();
  });

  test("other roles aren't affected", async ({ page }) => {
    await signIn(page, USERS.viewer);
    await page.goto("/deals");
    await expect(page).toHaveURL(/\/deals/);
  });
});
