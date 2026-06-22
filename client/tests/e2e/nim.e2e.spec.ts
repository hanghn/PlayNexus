import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createAndLoadGame } from "./testUtils.ts";

let userContext1: BrowserContext;
let userContext2: BrowserContext;
let page1: Page;
let page2: Page;

test.beforeEach(async ({ browser }) => {
  userContext1 = await browser.newContext();
  userContext2 = await browser.newContext();
  page1 = await userContext1.newPage();
  page2 = await userContext2.newPage();
});

test.afterEach(async () => {
  await userContext1.close();
  await userContext2.close();
});

test.describe("The game selection infrastructure", () => {
  test("should support creating a new Nim game and having a second user join it", async () => {
    await createAndLoadGame(page1, page2, "nim", true, true);
  });
});

test.describe("The game of Nim", () => {
  let username1: string;

  test.beforeEach(async () => {
    username1 = await createAndLoadGame(page1, page2, "nim", true, false);
  });

  test("should start player 1 with enabled buttons and player 2 with disabled buttons", async () => {
    await expect(page1.getByRole("button", { name: "Take 1" })).toBeEnabled();
    await expect(page1.getByRole("button", { name: "Take 2" })).toBeEnabled();
    await expect(page1.getByRole("button", { name: "Take 3" })).toBeEnabled();

    await expect(page2.getByRole("button", { name: "Take 1" })).toBeDisabled();
    await expect(page2.getByRole("button", { name: "Take 2" })).toBeDisabled();
    await expect(page2.getByRole("button", { name: "Take 3" })).toBeDisabled();
  });

  test("supports a playthrough with player 2 winning", async () => {
    await page1.getByRole("button", { name: "Take 3" }).click(); // 18 left
    await page2.getByRole("button", { name: "Take 3" }).click(); // 15 left
    await page1.getByRole("button", { name: "Take 3" }).click(); // 12 left
    await page2.getByRole("button", { name: "Take 3" }).click(); // 9 left
    await page1.getByRole("button", { name: "Take 3" }).click(); // 6 left
    await page2.getByRole("button", { name: "Take 2" }).click(); // 4 left
    await page1.getByRole("button", { name: "Take 2" }).click(); // 2 left

    await expect(page2.getByRole("button", { name: "Take 3" })).toBeDisabled();
    await expect(page2.getByRole("button", { name: "Take 2" })).toBeEnabled();
    await page2.getByRole("button", { name: "Take 1" }).click(); // 1 left

    await expect(page2.getByRole("button", { name: "Take 3" })).toBeDisabled();
    await expect(page2.getByRole("button", { name: "Take 2" })).toBeDisabled();
    await page1.getByRole("button", { name: "Take 1" }).click(); // 0 left

    await expect(
      page2.getByText(
        new RegExp(`you won by forcing ${username1} to take the last object\\.`, "i"),
      ),
    ).toBeVisible();
  });
});
