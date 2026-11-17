import { expect, test } from "@playwright/test";
import { signIn, uid, USERS } from "./fixtures";

test("lead → deal → won, then it shows in reports and exports", async ({ page }) => {
  const id = uid();
  const title = `E2E booking website ${id}`;
  await signIn(page, USERS.admin);

  await page.goto("/leads/new");
  await page.locator("#title").fill(title);
  await page.locator("#contactName").fill(`Nimal ${id}`);
  await page.locator("#companyName").fill(`E2E Hotels ${id}`);
  await page.locator("#whatsapp").fill("077 123 4567");
  await page.locator("#estimatedValue").fill("450000");
  await page.getByRole("button", { name: "Create lead" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("link", { name: "Convert to deal" }).click();
  await page.getByRole("button", { name: "Convert to deal" }).click();
  await expect(page).toHaveURL(/\/deals\/[a-z0-9]+$/);

  await page.getByRole("button", { name: "Mark won" }).click();
  await expect(page.getByText("Won", { exact: true }).first()).toBeVisible();

  await page.goto("/reports?period=this-month");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await page.getByRole("button", { name: "Export CSV" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /^Deals/ }).click()]);
  const path = await download.path();
  const csv = (await import("node:fs")).readFileSync(path, "utf8");
  expect(csv).toContain(title);
  expect(csv).toMatch(new RegExp(`${title}.*,Won,`));
});

test("a support ticket gets a number and a reply deadline", async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto("/support/new");
  const subject = `E2E checkout error ${uid()}`;
  await page.locator("#subject").fill(subject);
  await page.locator("#companyId").selectOption({ index: 1 });
  await page.locator("#priority").selectOption("URGENT");
  await page.getByRole("button", { name: "Create ticket" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`T-\\d{4}-\\d{4} · ${subject}`) })).toBeVisible();
  await expect(page.getByText(/Reply in|Reply overdue/).first()).toBeVisible();
});
