import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./fixtures";

test.describe("sign-in", () => {
  test("wrong password is refused without saying which part was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.admin.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  });

  test("five wrong passwords lock the account", async ({ page }) => {
    const attempt = async (password: string) => {
      await page.getByLabel("Email").fill(USERS.locked.email);
      await page.getByLabel("Password").fill(password);
      // Wait for the server's answer, so we never read the previous attempt's message.
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")), page.getByRole("button", { name: "Sign in" }).click()]);
    };
    await page.goto("/login");
    for (let i = 0; i < 4; i++) {
      await attempt(`wrong-${i}`);
      await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    }
    await attempt("wrong-4");
    await expect(page.getByText(/locked for 15 minutes/)).toBeVisible();
    // Even the right password is refused while locked.
    await attempt(USERS.locked.password);
    await expect(page.getByText(/Too many wrong passwords/)).toBeVisible();
  });

  test("viewers can read but not reach admin pages or exports", async ({ page }) => {
    await signIn(page, USERS.viewer);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await page.goto("/settings/users");
    await expect(page).toHaveURL(/\/dashboard\?denied=1/);
    const res = await page.request.get("/reports/export?type=deals");
    expect(res.status()).toBe(403);
    await page.goto("/leads/new");
    await expect(page).toHaveURL(/\/dashboard\?denied=1/);
  });
});
