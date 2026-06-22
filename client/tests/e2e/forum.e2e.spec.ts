import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signUpUser } from "./testUtils.ts";

let ctx: BrowserContext;
let page: Page;

test.beforeEach(async ({ browser }) => {
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await signUpUser(page);
});

test.afterEach(async () => {
  await ctx.close();
});

test.describe("Forum thread list", () => {
  test("shows the forum page with a button to create a new post", async () => {
    await page.goto("/forum");
    await expect(page.locator(".forum-cta")).toBeVisible();
  });

  test("newly created thread appears in the forum list", async () => {
    const title = `Forum list test ${Math.floor(Math.random() * 1_000_000)}`;
    await page.goto("/forum/post/new");
    await page.fill("#new-thread-title", title);
    await page.fill("#new-thread-contents", "Body.");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/forum\/post\/.+/);

    await page.goto("/forum");
    await expect(page.locator(".thread-row", { hasText: title })).toBeVisible();
  });
});

test.describe("Creating a forum thread", () => {
  test("creates a new thread and redirects to the thread page", async () => {
    await page.goto("/forum/post/new");
    await page.fill("#new-thread-title", "My E2E Thread Title");
    await page.fill("#new-thread-contents", "My E2E thread body.");
    await page.getByRole("button", { name: "Create" }).click();

    await page.waitForURL(/\/forum\/post\/.+/);
    await expect(page.locator(".thread-title")).toContainText("My E2E Thread Title");
    await expect(page.locator(".thread-body")).toContainText("My E2E thread body.");
  });

  test("clicking the forum-cta button navigates to the new-thread form", async () => {
    await page.goto("/forum");
    await page.locator(".forum-cta").click();
    await page.waitForURL("/forum/post/new");
    await expect(page.locator("#new-thread-title")).toBeVisible();
  });
});

test.describe("Forum comments", () => {
  test.beforeEach(async () => {
    await page.goto("/forum/post/new");
    await page.fill("#new-thread-title", "Comment Test Thread");
    await page.fill("#new-thread-contents", "Body for comment tests.");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/forum\/post\/.+/);
  });

  test("adds a comment to a thread", async () => {
    await page.locator(".redditBox-input").fill("Hello, this is a test comment!");
    await page.locator(".redditBox-submit").click();

    await expect(
      page.locator(".thread-comment", { hasText: "Hello, this is a test comment!" }),
    ).toBeVisible();
  });

  test("submit button is disabled when the comment textarea is empty", async () => {
    await expect(page.locator(".redditBox-submit")).toBeDisabled();
  });

  test("can delete own comment", async () => {
    await page.locator(".redditBox-input").fill("Delete me");
    await page.locator(".redditBox-submit").click();
    const comment = page.locator(".thread-comment", { hasText: "Delete me" });
    await expect(comment).toBeVisible();

    // removeComment calls window.confirm; accept it so the delete proceeds.
    page.once("dialog", (dialog) => void dialog.accept());
    await comment.locator(".thread-delete-btn").click();
    await expect(comment).not.toBeVisible();
  });

  test("can reply to the original post and the reply shows a quoted block", async () => {
    await page.locator(".thread-hero .thread-reply-btn").click();
    await expect(page.locator(".redditBox-replyTo")).toBeVisible();

    await page.locator(".redditBox-input").fill("Quoted reply text");
    await page.locator(".redditBox-submit").click();

    const replyComment = page.locator(".thread-comment", { hasText: "Quoted reply text" });
    await expect(replyComment).toBeVisible();
    await expect(replyComment.locator(".thread-quote")).toBeVisible();
  });

  test("can cancel an in-progress reply", async () => {
    await page.locator(".thread-hero .thread-reply-btn").click();
    await expect(page.locator(".redditBox-replyTo")).toBeVisible();

    await page.locator(".redditBox-cancel").click();
    await expect(page.locator(".redditBox-replyTo")).not.toBeVisible();
  });

  test("can reply to a comment", async () => {
    await page.locator(".redditBox-input").fill("Original comment");
    await page.locator(".redditBox-submit").click();
    await expect(page.locator(".thread-comment", { hasText: "Original comment" })).toBeVisible();

    // The comment has two .thread-reply-btn buttons (Reply + Delete); target by name.
    await page
      .locator(".thread-comment", { hasText: "Original comment" })
      .getByRole("button", { name: "↩︎ Reply" })
      .click();
    await expect(page.locator(".redditBox-replyTo")).toBeVisible();

    await page.locator(".redditBox-input").fill("Reply to comment");
    await page.locator(".redditBox-submit").click();

    await expect(
      page.locator(".thread-comment", { hasText: "Reply to comment" }).locator(".thread-quote"),
    ).toBeVisible();
  });
});
