import { expect, test } from "@playwright/test";
import { currentStep, hotp } from "../../src/lib/security/totp";
import { signIn, signOut, USERS } from "./fixtures";

test("two-step sign-in: set up, sign in with a code, then with a recovery code", async ({ page }) => {
  await signIn(page, USERS.twoFactor);
  await page.goto("/settings/profile");
  await page.getByRole("button", { name: "Set up two-step sign-in" }).click();
  const secret = (await page.getByTestId("totp-secret").innerText()).replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  // A wrong code is refused.
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("That code didn't work")).toBeVisible();

  // Use the previous step's code (allowed for clock drift) so the current one is still fresh for sign-in.
  await page.getByLabel("6-digit code").fill(hotp(secret, currentStep() - 1));
  await page.getByRole("button", { name: "Turn on" }).click();
  const codeItems = page.getByRole("list", { name: "Recovery codes" }).locator("li");
  await expect(codeItems).toHaveCount(10);
  const codes = await codeItems.allInnerTexts();
  await page.getByRole("button", { name: "I've saved them" }).click();
  await expect(page.getByText(/On\. You.ll be asked for a code/)).toBeVisible();

  // Sign in again: password, then the code.
  await signOut(page);
  await signIn(page, USERS.twoFactor, /\/login\/verify/);
  await page.getByLabel("Code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByText("That code didn't work")).toBeVisible();
  await page.getByLabel("Code").fill(hotp(secret, currentStep()));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Lost phone: a recovery code works once.
  await signOut(page);
  await signIn(page, USERS.twoFactor, /\/login\/verify/);
  await page.getByRole("button", { name: /Use a recovery code/ }).click();
  await page.getByLabel("Recovery code").fill(codes[0].toLowerCase());
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/settings\/profile\?recovery=1/);
  await expect(page.getByText("9 of 10 recovery codes left.")).toBeVisible();

  await signOut(page);
  await signIn(page, USERS.twoFactor, /\/login\/verify/);
  await page.getByRole("button", { name: /Use a recovery code/ }).click();
  await page.getByLabel("Recovery code").fill(codes[0]);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByText("That code didn't work")).toBeVisible();
});

test("going straight to the code page without a password sends you back", async ({ page }) => {
  await page.goto("/login/verify");
  await expect(page).toHaveURL(/\/login\?expired=1/);
});
