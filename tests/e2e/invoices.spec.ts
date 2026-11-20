import { expect, test } from "@playwright/test";
import { signIn, sql, uid, USERS } from "./fixtures";

/** An accepted quote: LKR 400,000 + 18% VAT = 472,000. */
async function acceptedQuote(title: string) {
  const [company] = await sql(`INSERT INTO "Company" (id, name, "taxId", "updatedAt") VALUES (gen_random_uuid()::text, $1, '114567890-7000', now()) RETURNING id`, [`${title} Ltd`]);
  const [quote] = await sql(
    `INSERT INTO "Quote" (id, number, title, status, currency, "issueDate", "taxLabel", "taxRate", subtotal, "discountTotal", "taxTotal", total, "companyId", "acceptedAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'ACCEPTED', 'LKR', now(), 'VAT', 18, 400000, 0, 72000, 472000, $3, now(), now()) RETURNING id`,
    [`Q-E2E-${uid()}`, title, company.id],
  );
  await sql(
    `INSERT INTO "QuoteItem" (id, "quoteId", position, title, quantity, unit, "unitPrice", "lineTotal") VALUES (gen_random_uuid()::text, $1, 0, 'Booking website', 1, 'project', 400000, 400000)`,
    [quote.id],
  );
  return quote.id as string;
}

test("accepted quote → 50% advance invoice → payment and receipt → balance invoice → paid", async ({ page }) => {
  const title = `E2E Guest house site ${uid()}`;
  const quoteId = await acceptedQuote(title);
  await signIn(page, USERS.admin);

  // Advance: 50% of 400,000 + VAT = 236,000.
  await page.goto(`/quotes/${quoteId}`);
  await expect(page.getByText("LKR 400,000 of LKR 400,000 still to invoice")).toBeVisible();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /INV-\d{4}-\d{4}/ })).toBeVisible();
  await expect(page.getByText("Advance payment (50%)").first()).toBeVisible();
  await expect(page.getByText("Rupees Two Hundred Thirty-Six Thousand Only")).toBeVisible();
  await expect(page.getByText("VAT/TIN: 114567890-7000")).toBeVisible();
  const advanceUrl = page.url();

  // The PDF renders.
  const pdf = await page.request.get(`${advanceUrl}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Paying more than the balance is refused; the balance itself goes through and makes a receipt.
  await page.getByLabel("Amount received").fill("300000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("That's more than the balance")).toBeVisible();
  await page.getByLabel("Amount received").fill("236000");
  await page.getByLabel("Reference").fill("BOC 99812");
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/invoices/"));
  await page.getByRole("button", { name: "Record payment" }).click();
  await saved;
  // Paid in full: the payment form goes away and the receipt is listed under Payments.
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  const receiptLink = page.getByRole("link", { name: /^RCT-\d{4}-\d{4}$/ });
  await expect(receiptLink).toHaveCount(1);
  const receiptHref = await receiptLink.getAttribute("href");
  const receipt = await page.request.get(receiptHref!);
  expect(receipt.status()).toBe(200);
  expect(receipt.headers()["content-type"]).toBe("application/pdf");

  // Balance: the remaining 200,000 + VAT.
  await page.goto(`/quotes/${quoteId}`);
  await expect(page.getByText("LKR 200,000 of LKR 400,000 still to invoice")).toBeVisible();
  await page.getByLabel(/^Balance/).check();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).not.toHaveURL(advanceUrl);
  await expect(page.getByText("Balance payment").first()).toBeVisible();

  // A part payment, then the rest.
  await page.getByLabel("Amount received").fill("100000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment recorded\. Receipt RCT-\d{4}-\d{4}\./)).toBeVisible();
  await expect(page.getByRole("link", { name: "Receipt PDF" })).toBeVisible();
  await expect(page.getByText("Part paid").first()).toBeVisible();
  await page.getByLabel("Amount received").fill("136000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Record a payment")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^RCT-\d{4}-\d{4}$/ })).toHaveCount(2);

  // Fully invoiced, and both invoices are paid.
  await page.goto(`/quotes/${quoteId}`);
  await expect(page.getByText("This quote is fully invoiced.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create invoice" })).toHaveCount(0);
  const [{ paid }] = await sql(`SELECT count(*)::int AS paid FROM "Invoice" WHERE "quoteId" = $1 AND status = 'PAID'`, [quoteId]);
  expect(paid).toBe(2);
});

test("a voided invoice can be restored, unless the quote was invoiced again", async ({ page }) => {
  const quoteId = await acceptedQuote(`E2E Restore ${uid()}`);
  await signIn(page, USERS.admin);

  await page.goto(`/quotes/${quoteId}`);
  await page.getByLabel("Full amount").check();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
  const first = page.url();

  await page.getByRole("button", { name: "Void invoice" }).click();
  await page.getByRole("button", { name: "Yes, void" }).click();
  await expect(page.getByText("Void", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Restore invoice" }).click();
  await expect(page.getByRole("button", { name: "Void invoice" })).toBeVisible();
  await expect(page.getByText("Record a payment")).toBeVisible();

  // Void again, invoice the quote again, then try to restore the first: refused.
  await page.getByRole("button", { name: "Void invoice" }).click();
  await page.getByRole("button", { name: "Yes, void" }).click();
  await expect(page.getByRole("button", { name: "Restore invoice" })).toBeVisible();
  await page.goto(`/quotes/${quoteId}`);
  await page.getByLabel("Full amount").check();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).not.toHaveURL(new RegExp(`/quotes/`));
  await page.goto(first);
  await page.getByRole("button", { name: "Restore invoice" }).click();
  await expect(page.getByText(/Can't restore: Q-E2E-.* has been invoiced again/)).toBeVisible();
});

test("cancelling the latest payment frees its receipt number; an older one leaves a gap", async ({ page }) => {
  const quoteId = await acceptedQuote(`E2E Receipt reuse ${uid()}`);
  await signIn(page, USERS.admin);
  await page.goto(`/quotes/${quoteId}`);
  await page.getByLabel("Full amount").check();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);

  const pay = async (amount: string) => {
    await page.reload();
    await page.getByLabel("Amount received").fill(amount);
    await expect(page.getByLabel("Amount received")).toHaveValue(amount);
    await page.getByRole("button", { name: "Record payment" }).click();
    const msg = page.getByText(/Payment recorded\. Receipt RCT-\d{4}-\d{4}\./);
    await expect(msg).toBeVisible();
    return (await msg.textContent())!.match(/RCT-\d{4}-\d{4}/)![0];
  };
  const cancel = async (receipt: string) => {
    await page.getByRole("button", { name: `Cancel ${receipt}` }).click();
    await expect(page.getByText(`Cancel ${receipt}? Only if it was recorded by mistake.`)).toBeVisible();
    await page.getByRole("button", { name: "Yes, cancel payment" }).click();
    await expect(page.getByRole("link", { name: receipt })).toHaveCount(0);
  };

  // Latest receipt cancelled → the next payment gets the same number.
  const first = await pay("1000");
  // Asks first; "No" keeps the payment.
  await page.getByRole("button", { name: `Cancel ${first}` }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByRole("link", { name: first })).toBeVisible();
  await cancel(first);
  expect(await pay("1000")).toBe(first);

  // An older receipt cancelled → its number isn't reused (no duplicates).
  const second = await pay("2000");
  await cancel(first);
  const third = await pay("1500");
  expect(third).not.toBe(first);
  expect(Number(third.slice(-4))).toBe(Number(second.slice(-4)) + 1);
});
