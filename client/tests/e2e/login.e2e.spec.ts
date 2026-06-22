import { test, expect } from "@playwright/test";

test.describe("The login page", () => {
  const username = "user3";
  const password = "pwd3333";

  const randUsername = "user" + Math.floor(Math.random() * 1_000_000);
  const randPassword = "pwd_for_" + randUsername;

  test("should appear via redirect from /login in existing-user mode", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("/login");

    // Submit button is "Log In"; the toggle link is "Sign up" (exact-cased so it
    // never collides with the "Sign Up" submit button).
    await expect(page.getByRole("button", { name: "Log In", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Log in", exact: true })).not.toBeVisible();
  });

  test("should allow toggle between existing-user and new-user mode", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Sign up", exact: true }).click();

    await expect(page.getByRole("button", { name: "Log In", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up", exact: true })).not.toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Log in", exact: true }).click();

    await expect(page.getByRole("button", { name: "Log In", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Log in", exact: true })).not.toBeVisible();
  });

  test("should allow an existing user to log in", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Username").fill(username);
    // { exact: true } is necessary here to avoid capturing the "Show Password" checkbox
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log In" }).click();

    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: "Frau Drei" })).toBeVisible();
  });

  test("should reject an incorrect password with a message, and allow correction", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Username").fill(username);
    // { exact: true } is necessary here to avoid capturing the "Show Password" checkbox
    await page.getByLabel("Password", { exact: true }).fill(randPassword);
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page.getByText("Invalid username or password")).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: "Frau Drei" })).toBeVisible();
  });

  test("should reject creating an account for an existing user, and allow correction", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign up", exact: true }).click();

    await page.getByLabel("Username").fill(username);
    // { exact: true } is necessary here to avoid capturing the "Show Password" checkbox and "Confirm Password" button
    await page.getByLabel("Password", { exact: true }).fill(randPassword);
    await page.getByLabel("Confirm Password").fill(randPassword);
    await page.getByRole("button", { name: "Sign Up" }).click();

    await expect(page.getByText("User already exists")).toBeVisible();

    await page.getByLabel("Username", { exact: true }).fill(randUsername);
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("button", { name: randUsername })).toBeVisible();
  });
});
