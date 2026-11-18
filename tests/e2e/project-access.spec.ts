import { expect, test } from "@playwright/test";
import { signIn, signOut, sql, uid, USERS } from "./fixtures";

async function wonDeal(title: string) {
  const [stage] = await sql(`SELECT s.id, s."pipelineId" FROM "PipelineStage" s WHERE s."isWon" ORDER BY s.position LIMIT 1`);
  const [deal] = await sql(
    `INSERT INTO "Deal" (id, title, value, currency, status, "pipelineId", "stageId", "closedAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 450000, 'LKR', 'WON', $2, $3, now(), now()) RETURNING id`,
    [title, stage.pipelineId, stage.id],
  );
  return deal.id as string;
}

test("project access: record the Gmail and services, refuse secrets, check, close out, hand over", async ({ page }) => {
  const title = `E2E Hotel booking ${uid()}`;
  const dealId = await wonDeal(title);
  await signIn(page, USERS.admin);

  await page.goto(`/deals/${dealId}`);
  await page.getByRole("link", { name: "Set up" }).click();
  await expect(page).toHaveURL(new RegExp(`/deals/${dealId}/access`));

  // A password typed into the form is refused.
  await page.getByLabel("Project Gmail").fill("e2e.hotel.softro@gmail.com");
  await page.getByLabel("Password and backup codes are kept in").fill("password: Hotel@2026!");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/looks like a password or key/)).toBeVisible();

  await page.getByLabel("Password and backup codes are kept in").fill("Bitwarden → Softro Projects → Hotel");
  await page.getByLabel("Settings (.env) are kept in").fill("Vercel project settings");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText("Never checked.")).toBeVisible();

  // Add a service with a renewal date → a reminder task is created.
  await page.getByRole("button", { name: "Add a service" }).click();
  await page.getByLabel("Service").fill("Domain (hotel.lk)");
  await page.getByLabel("Type").selectOption("DOMAIN");
  await page.getByLabel("Address").fill("dash.cloudflare.com");
  await page.getByLabel("Account owner").selectOption("CLIENT");
  await page.getByLabel("Renews on").fill("2027-03-12");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByRole("cell", { name: /Domain \(hotel\.lk\)/ }).first()).toBeVisible();
  const tasks = await sql(`SELECT subject FROM "Activity" WHERE "dealId" = $1 AND "completedAt" IS NULL ORDER BY subject`, [dealId]);
  expect(tasks.map((t) => t.subject)).toEqual([`Check project Gmail: ${title}`, `Remind client to renew Domain (hotel.lk): ${title}`]);

  // The 6-monthly check.
  await page.getByRole("button", { name: "I signed in and checked it" }).click();
  await expect(page.getByText("Next check in 6 months.")).toBeVisible();

  // Can't archive until the checklist is done.
  await expect(page.getByRole("button", { name: "Archive project access" })).toBeDisabled();
  for (const box of await page.locator('input[type="checkbox"]').all()) await box.check();
  await page.getByRole("button", { name: "Archive project access" }).click();
  await expect(page.getByRole("button", { name: "Reopen for maintenance" })).toBeVisible();

  // Handover document: numbered, frozen, a real PDF.
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Create handover PDF" }).click()]);
  await popup.close();
  const link = page.getByRole("link", { name: /H-\d{4}-\d{4}/ });
  await expect(link).toBeVisible();
  const res = await page.request.get((await link.getAttribute("href"))!);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // It's listed on the Project access page, under Archived.
  await page.goto("/access?tab=archived");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  // Viewers can't see the register.
  await signOut(page);
  await signIn(page, USERS.viewer);
  await page.goto(`/deals/${dealId}/access`);
  await expect(page).toHaveURL(/\/dashboard\?denied=1/);
});
