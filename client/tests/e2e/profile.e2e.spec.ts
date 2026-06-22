import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { signUpUser } from "./testUtils.ts";

let ctx: BrowserContext;
let page: Page;
let username: string;

test.beforeEach(async ({ browser }) => {
  ctx = await browser.newContext();
  page = await ctx.newPage();
  ({ username } = await signUpUser(page));
});

test.afterEach(async () => {
  await ctx.close();
});

test.describe("Own profile page", () => {
  test("shows the logged-in user's handle and editable fields", async () => {
    await page.goto(`/profile/${username}`);
    await expect(page.locator(".pf-hero-handle")).toContainText(`@${username}`);
    await expect(page.getByLabel("Display name")).toBeVisible();
    await expect(page.getByLabel("Bio")).toBeVisible();
    await expect(page.getByLabel("Pick a banner color")).toBeVisible();
  });

  test("Reset button restores the display name to the username", async () => {
    await page.goto(`/profile/${username}`);
    const displayInput = page.getByLabel("Display name");
    await displayInput.fill("Temporary Name");
    await page.getByRole("button", { name: "Reset" }).first().click();
    await expect(displayInput).toHaveValue(username);
  });

  test("saves an updated bio and persists it after reload", async () => {
    await page.goto(`/profile/${username}`);
    await page.getByLabel("Bio").fill("A short test bio.");
    await page.getByRole("button", { name: "Save" }).first().click();
    // Wait for the save to be confirmed before reloading
    await expect(page.getByText("Bio saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Bio")).toHaveValue("A short test bio.");
  });

  test("clicking a color swatch updates the banner color hex input", async () => {
    await page.goto(`/profile/${username}`);
    await page.locator(".pf-swatch").first().click();
    await expect(page.getByLabel("Banner color hex code")).not.toHaveValue("");
  });

  test("Clear button empties the banner color hex input", async () => {
    await page.goto(`/profile/${username}`);
    // Select any swatch to ensure a color is set before clearing.
    await page.locator(".pf-swatch").first().click();
    await expect(page.getByLabel("Banner color hex code")).not.toHaveValue("");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByLabel("Banner color hex code")).toHaveValue("");
  });

  test("friends section toggle changes aria-expanded state", async () => {
    await page.goto(`/profile/${username}`);
    // The friends toggle is the only .pf-friends-toggle with aria-expanded.
    const toggle = page.locator(".pf-friends-toggle[aria-expanded]");
    const before = await toggle.getAttribute("aria-expanded");
    await toggle.click();
    const after = await toggle.getAttribute("aria-expanded");
    expect(before).not.toBe(after);
  });

  test("shows win/loss/draw stats", async () => {
    await page.goto(`/profile/${username}`);
    await expect(page.locator(".pf-stat").first()).toBeVisible();
  });
});

test.describe("Viewing another user's public profile", () => {
  let ctx2: BrowserContext;
  let page2: Page;
  let username2: string;

  test.beforeEach(async ({ browser }) => {
    ctx2 = await browser.newContext();
    page2 = await ctx2.newPage();
    ({ username: username2 } = await signUpUser(page2));
  });

  test.afterEach(async () => {
    await ctx2.close();
  });

  test("shows the other user's handle on their profile page", async () => {
    await page.goto(`/profile/${username2}`);
    await expect(page.locator(".pf-hero-handle")).toContainText(`@${username2}`);
  });

  test("does not show editable fields on another user's profile", async () => {
    await page.goto(`/profile/${username2}`);
    await expect(page.getByLabel("Bio")).not.toBeVisible();
    await expect(page.getByLabel("Display name")).not.toBeVisible();
  });

  test("shows a Message button on another user's profile", async () => {
    await page.goto(`/profile/${username2}`);
    await expect(page.getByRole("button", { name: "Message" })).toBeVisible();
  });
});
