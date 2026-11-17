import { expect, test } from "@playwright/test";

test.describe("public surface", () => {
  test("health check reports the database is up", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", database: "ok" });
  });

  test("pages send security headers", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
    await page.goto("/deals?tab=open");
    await expect(page).toHaveURL(/\/login\?next=%2Fdeals%3Ftab%3Dopen/);
  });

  test("protected endpoints refuse anonymous calls", async ({ request }) => {
    expect((await request.get("/api/cron/daily-digest")).status()).toBeGreaterThanOrEqual(401);
    expect((await request.post("/api/leads", { data: { name: "x" } })).status()).toBe(401);
    expect((await request.get("/api/calendar/not-a-real-token.ics")).status()).toBe(404);
    expect((await request.get("/reports/export?type=deals", { maxRedirects: 0 })).status()).toBe(307);
  });
});
