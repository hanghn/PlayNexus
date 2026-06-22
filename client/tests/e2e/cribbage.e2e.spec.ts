import { test, expect, type Page } from "@playwright/test";

/** Create a fresh account and land on the home page. */
async function signUp(page: Page): Promise<string> {
  const username = "crib" + Math.floor(Math.random() * 2_000_000);
  const password = "pwd_for_" + username;
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();
  await page.waitForURL("/");
  return username;
}

/** Start a single-player Cribbage game against the Easy AI. */
async function startCribbageVsEasyAI(page: Page) {
  await page.getByRole("button", { name: "Create New Game" }).click();
  await page.getByRole("menuitem", { name: "Cribbage" }).click();
  await page.getByRole("button", { name: "vs Easy AI" }).click();
  // Single-player games auto-start: the human is player #1.
  await expect(page.getByText("you are player #1")).toBeVisible();
}

test.describe("Single-player Cribbage vs the AI", () => {
  test("starts a game and renders the board and cut-for-deal prompt", async ({ page }) => {
    await signUp(page);
    await startCribbageVsEasyAI(page);

    // The cut-for-deal fan is interactive in the default (windowed) layout.
    await expect(page.getByRole("button", { name: "Cut card 1", exact: true })).toBeVisible();
    // The hand is in the cut phase, prompting the player to cut for the deal.
    await expect(
      page.getByText("Click a card. The lower card deals first and takes the first crib."),
    ).toBeVisible();
  });
});
