import { expect, type Page } from "@playwright/test";

/** Test accounts, created fresh by global-setup.ts before every run. */
export const USERS = {
  admin: { email: "e2e-admin@softro.test", password: "E2e-Admin-Pass#2026", name: "E2E Admin" },
  viewer: { email: "e2e-viewer@softro.test", password: "E2e-Viewer-Pass#2026", name: "E2E Viewer" },
  twoFactor: { email: "e2e-2fa@softro.test", password: "E2e-TwoStep-Pass#2026", name: "E2E TwoStep" },
  locked: { email: "e2e-lock@softro.test", password: "E2e-Lock-Pass#2026", name: "E2E Lock" },
} as const;

export async function signIn(page: Page, user: { email: string; password: string }, expectUrl: RegExp = /\/dashboard/) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectUrl);
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}

/** A unique suffix so repeated runs don't collide. */
export const uid = () => Date.now().toString(36).slice(-6);

/** Direct SQL against the TEST database, for setting up states the UI guards (e.g. company-wide rules). */
export async function sql(query: string, params: unknown[] = []) {
  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(query, params)).rows;
  } finally {
    await client.end();
  }
}
