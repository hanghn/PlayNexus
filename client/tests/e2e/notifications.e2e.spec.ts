import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { logInUser, makeFriends, signUpUser } from "./testUtils.ts";

let ctx1: BrowserContext;
let ctx2: BrowserContext;
let page1: Page;
let page2: Page;

test.beforeEach(async ({ browser }) => {
  ctx1 = await browser.newContext();
  ctx2 = await browser.newContext();
  page1 = await ctx1.newPage();
  page2 = await ctx2.newPage();
});

test.afterEach(async () => {
  await ctx1.close();
  await ctx2.close();
});

test.describe("Social toast notifications", () => {
  test("a friend-request toast appears for the recipient", async () => {
    const { username: username1 } = await signUpUser(page1);
    await logInUser(page2, "user2", "pwd2222");

    // user1 sends a friend request to user2; user2 (on Home) should get a toast.
    await page1.goto("/friends");
    await page1.getByLabel("Add a friend by username").fill("user2");
    await page1.getByRole("button", { name: "Add" }).click();

    await expect(page2.getByText(`${username1} sent you a friend request`)).toBeVisible();
  });

  test("a DM toast appears for the recipient", async () => {
    const { username: username1 } = await signUpUser(page1);
    await logInUser(page2, "user2", "pwd2222");
    await makeFriends(page1, username1, page2, "user2");

    // user2 sits on Home; user1 opens a thread and sends a message.
    await page2.goto("/");
    await page1.goto("/messages");
    await page1.getByLabel("Message a username").fill("user2");
    await page1.getByRole("button", { name: "Go" }).click();
    await expect(page1).toHaveURL(/\/messages\/.+/);
    const composer = page1.getByLabel("Message", { exact: true });
    await composer.fill(`ping-${username1}`);
    await composer.press("Enter");

    await expect(page2.getByText(`${username1} sent you a message`)).toBeVisible();
  });
});
