import { test, expect } from "@playwright/test";
import { logInUser } from "./testUtils";

const NAV_LABELS = ["Home", "Games", "Forum", "Friends", "Messages", "Profile"];

/**
 * Proves the app is operable by keyboard alone: Tab reaches every primary nav
 * control with a visible focus ring, and a focused link activates with Enter.
 */
test.describe("Keyboard operability", () => {
  test("Tab reaches every primary nav link with a visible focus ring", async ({ page }) => {
    await logInUser(page, "user2", "pwd2222");
    await page.waitForLoadState("networkidle");

    const focused = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(),
          outlineStyle: cs.outlineStyle,
        };
      });

    const seen: { tag: string; text: string; outlineStyle: string }[] = [];
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Tab");
      const f = await focused();
      if (f) seen.push(f);
    }

    // Every nav link must be tab-focusable...
    const matches = (text: string, label: string) => text === label || text.startsWith(label);
    for (const label of NAV_LABELS) {
      expect(
        seen.some((s) => matches(s.text, label)),
        `nav "${label}" should be reachable by Tab`,
      ).toBe(true);
    }

    // ...and each one must paint a real focus outline (not "none") when focused.
    const navFocuses = seen.filter((s) => NAV_LABELS.some((l) => matches(s.text, l)));
    expect(navFocuses.length).toBeGreaterThanOrEqual(NAV_LABELS.length);
    expect(navFocuses.every((s) => s.outlineStyle !== "none")).toBe(true);
  });

  test("a focused nav link activates with the Enter key", async ({ page }) => {
    await logInUser(page, "user2", "pwd2222");
    await page.getByRole("link", { name: "Games" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/games");
  });

  test("Up/Down browse the sidebar nav", async ({ page }) => {
    await logInUser(page, "user2", "pwd2222");
    await page.getByRole("link", { name: "Home" }).focus();

    await page.keyboard.press("ArrowDown");
    await expect(page.locator(":focus")).toHaveText(/^Games/);
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(":focus")).toHaveText(/^Forum/);
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(":focus")).toHaveText(/^Games/);
  });

  test("ArrowRight from a nav item jumps into the page content", async ({ page }) => {
    await logInUser(page, "user2", "pwd2222");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Forum" }).focus();
    await page.keyboard.press("ArrowRight");
    // Focus is now on the first focusable element inside the main content region.
    await expect(page.locator("#right_main :focus")).toHaveCount(1);
  });

  test("the skip link is the first Tab stop and jumps to the main region", async ({ page }) => {
    await logInUser(page, "user2", "pwd2222");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText("Skip to main content");
    await page.keyboard.press("Enter");
    await expect(page.locator("#right_main")).toBeFocused();
  });

  test("the screen-reader live regions are present in the DOM", async ({ page }) => {
    await logInUser(page, "user2", "pwd2222");
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
    await expect(page.locator('[aria-live="assertive"]')).toHaveCount(1);
  });
});
