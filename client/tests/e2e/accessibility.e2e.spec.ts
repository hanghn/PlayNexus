import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { logInUser } from "./testUtils.ts";

// Use the seeded "Bob" demo account so the scans run against stable, meaningful
// data in both local dev and CI — and without signing up throwaway accounts
// that pollute the database.
const BOB = { username: "Bob", password: "pwdbob" };

// "Hello game knights" is seeded at a fixed thread id (see initRepository).
const SEEDED_THREAD = "deadbeefdeadbeefdeadbeef";

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("Accessibility checks", () => {
  test("home page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await expect(page.getByRole("button", { name: "Create New Game" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a game page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    // A single-player Cribbage game vs the AI — no second account is created.
    await page.getByRole("button", { name: "Create New Game" }).click();
    await page.getByRole("menuitem", { name: "Cribbage" }).click();
    await page.getByRole("button", { name: "vs Easy AI" }).click();
    await expect(page.getByText("you are player #1")).toBeVisible();
    await expectNoViolations(page);
  });

  test("profile page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/profile/Bob");
    await expect(page.getByText("@Bob")).toBeVisible();
    await expectNoViolations(page);
  });

  test("login page has no accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log into PlayNexus" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("friends page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/friends");
    await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
    await expectNoViolations(page);
  });

  test("forum list has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/forum");
    await expect(page.getByRole("heading", { name: "Forum" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a forum thread page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto(`/forum/post/${SEEDED_THREAD}`);
    await expect(page.getByRole("heading", { name: "Hello game knights" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("the new-post form has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/forum/post/new");
    await expect(page.getByRole("heading", { name: "Create new post" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("messages inbox has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/messages");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a DM conversation has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/messages");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    // Open Bob's first conversation from the inbox.
    await page.locator(".dm-row").first().click();
    await expect(page).toHaveURL(/\/messages\/.+/);
    await expectNoViolations(page);
  });

  test("games lobby has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: "All games" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("cribbage help page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/help/cribbage");
    await expect(page.getByRole("heading", { name: "How to play Cribbage" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("the not-found page has no accessibility violations", async ({ page }) => {
    await logInUser(page, BOB.username, BOB.password);
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText(/No page found for route/)).toBeVisible();
    await expectNoViolations(page);
  });
});
