import { test, expect, type BrowserContext } from "@playwright/test";

/**
 * Verifies that a logged-in session survives a page reload (the cookie-based
 * session restore). None of the game tests exercise this, so it is easy to
 * regress.
 */
test.describe("Session persistence", () => {
  test("stays logged in after a page reload (fresh signup)", async ({ page }) => {
    const username = "user" + Math.floor(Math.random() * 2_000_000);
    const password = "pwd_for_" + username;

    await page.goto("/login");
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: /Account menu for/ })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /Account menu for/ })).toBeVisible();
  });

  test("stays logged in after a page reload (existing account, log in)", async ({ browser }) => {
    const username = "user" + Math.floor(Math.random() * 2_000_000);
    const password = "pwd_for_" + username;

    // Create the account in one context, then log in fresh in another so we
    // exercise the pure login path (not the signup auto-login).
    const setup: BrowserContext = await browser.newContext();
    const setupPage = await setup.newPage();
    await setupPage.goto("/login");
    await setupPage.getByRole("button", { name: "Sign up", exact: true }).click();
    await setupPage.getByLabel("Username").fill(username);
    await setupPage.getByLabel("Password", { exact: true }).fill(password);
    await setupPage.getByLabel("Confirm Password").fill(password);
    await setupPage.getByRole("button", { name: "Sign Up" }).click();
    await setupPage.waitForURL("/");
    await setup.close();

    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: /Account menu for/ })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("button", { name: /Account menu for/ })).toBeVisible();
    await ctx.close();
  });
});
