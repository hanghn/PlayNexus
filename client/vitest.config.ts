import { defineConfig } from "vitest/config";

/**
 * Vitest config for the client's unit/component tests.
 *
 * The Playwright end-to-end specs under `tests/e2e/` are run by Playwright
 * (`npm test` → `playwright test`), NOT Vitest — they import `@playwright/test`
 * and call `test.describe()` in a way Vitest cannot execute, so they are
 * excluded here. Component/unit tests render via @testing-library/react and need
 * a DOM, so the environment is jsdom for every test file.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    // jsdom only exposes the Web Storage API (localStorage/sessionStorage) for a
    // real, non-opaque origin; without this the bare `localStorage` global is
    // undefined and falls through to Node's experimental stub.
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts", "src/main.tsx"],
    },
  },
});
