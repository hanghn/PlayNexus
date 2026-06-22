import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { logInUser, makeFriends, signUpUser } from "./testUtils.ts";

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

test.describe("Direct messages", () => {
  test("two users start a thread and exchange messages in real time", async () => {
    // A fresh user1 (display defaults to its username) messages the seeded user2.
    const { username: username1 } = await signUpUser(page1);
    await logInUser(page2, "user2", "pwd2222");

    // DMs are friends-only, so the two users must be friends first.
    await makeFriends(page1, username1, page2, "user2");

    // user1 opens a DM to user2 from the inbox composer. (page2 stays on /friends
    // so the live unread badge can fire when the first message arrives.)
    await page1.getByRole("link", { name: "Messages" }).click();
    await expect(page1).toHaveURL("/messages");
    await page1.getByLabel("Message a username").fill("user2");
    await page1.getByRole("button", { name: "Go" }).click();

    // The new thread opens, addressed to user2 (display "Sénior Dos", handle @user2).
    await expect(page1).toHaveURL(/\/messages\/.+/);
    await expect(page1.getByText("@user2")).toBeVisible();

    // user1 sends the first message and sees it echoed back (socket round-trip).
    const msg1 = `hello-from-${username1}`;
    const composer1 = page1.getByLabel("Message", { exact: true });
    await composer1.fill(msg1);
    await composer1.press("Enter");
    await expect(page1.getByText(msg1)).toBeVisible();

    // user2, sitting on Home, sees the unread cue appear live on the Messages nav.
    await expect(page2.getByLabel(/unread message/)).toBeVisible();

    // user2 opens the inbox and clicks the conversation (matched by its preview).
    await page2.getByRole("link", { name: "Messages" }).click();
    await page2.getByRole("button").filter({ hasText: msg1 }).click();
    await expect(page2).toHaveURL(/\/messages\/.+/);
    await expect(page2.getByText(msg1)).toBeVisible();

    // Opening the thread clears the unread cue.
    await expect(page2.getByLabel(/unread message/)).not.toBeVisible();

    // user2 replies; user1 (still viewing the thread) receives it in real time.
    const msg2 = `reply-from-user2-${username1}`;
    const composer2 = page2.getByLabel("Message", { exact: true });
    await composer2.fill(msg2);
    await composer2.press("Enter");

    await expect(page1.getByText(msg2)).toBeVisible();

    // Both messages are visible to both participants.
    await expect(page1.getByText(msg1)).toBeVisible();
    await expect(page2.getByText(msg2)).toBeVisible();
  });

  test("a quoted reply shows the original message above the response", async () => {
    const { username: username1 } = await signUpUser(page1);
    await logInUser(page2, "user2", "pwd2222");
    await makeFriends(page1, username1, page2, "user2");

    // user1 opens a thread with user2 and sends a message.
    await page1.goto("/messages");
    await page1.getByLabel("Message a username").fill("user2");
    await page1.getByRole("button", { name: "Go" }).click();
    await expect(page1).toHaveURL(/\/messages\/.+/);

    const original = `quote-me-${username1}`;
    const composer1 = page1.getByLabel("Message", { exact: true });
    await composer1.fill(original);
    await composer1.press("Enter");
    await expect(page1.getByText(original)).toBeVisible();

    // user2 opens the thread and replies *to* user1's message via its Reply action.
    await page2.goto("/messages");
    await page2.getByRole("button").filter({ hasText: original }).click();
    await expect(page2.getByText(original)).toBeVisible();

    // The Reply action is hover-revealed on the message row; user1's display
    // defaults to its username, so the action is labelled with it.
    const incoming = page2.locator(".chatOther", { hasText: original });
    await incoming.hover();
    await incoming.getByRole("button", { name: `Reply to ${username1}` }).click();
    await expect(page2.getByText(`Replying to ${username1}`)).toBeVisible();

    const reply = `quoted-reply-${username1}`;
    const composer2 = page2.getByLabel("Message", { exact: true });
    await composer2.fill(reply);
    await composer2.press("Enter");

    // The reply carries a quote of the original, visible to the original sender too.
    await expect(page1.getByText(reply)).toBeVisible();
    await expect(page1.locator(".chatQuote", { hasText: original })).toBeVisible();
  });

  test("messaging a username that does not exist shows an error", async () => {
    await signUpUser(page1);
    await page1.goto("/messages");

    await page1.getByLabel("Message a username").fill("no_such_user_12345");
    await page1.getByRole("button", { name: "Go" }).click();

    await expect(page1.getByText("User not found")).toBeVisible();
    // We stayed on the inbox; no thread was opened.
    await expect(page1).toHaveURL("/messages");
  });

  test("a brand-new user sees the empty inbox state", async () => {
    await signUpUser(page1);
    await page1.getByRole("link", { name: "Messages" }).click();

    await expect(page1.getByText("No conversations yet — message someone above.")).toBeVisible();
    await expect(page1.getByText("Pick a conversation, or start a new one.")).toBeVisible();
  });
});
