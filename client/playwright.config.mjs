import { defineConfig, devices } from "@playwright/test";

/* global process */ // TODO: is there a better way to avoid making ESLint angry?
export default defineConfig({
  // Where the tests live, relative to this file
  testDir: "./tests/e2e",

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI so a slow round-trip doesn't
  // fail the build; locally we keep 0 so flakes surface immediately.
  retries: process.env.CI ? 2 : 0,

  // Give assertions a longer window than the 5s default
  expect: { timeout: 10000 },

  // The HTML reporter gives nice, pretty reports
  reporter: process.env.CI ? "dot" : [["html", { outputFolder: "playwright-report" }]],

  // No parallelism (slower, but can avoid errors with overlapping tests)
  workers: 1,

  // Settings that we'd rather set once, rather than in every test file
  use: {
    baseURL: "http://localhost:4530",
  },

  // Just test with chrome
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],

  // This sets up the two-server development environment that we recommend,
  // the Vite frontend server that the tests will connect to, and the Express
  // server that serves API requests. The `reuseExistingServer` option means
  // that, if you already have your development environment running, tests
  // will just operate on that running server instead of starting a new
  // server.
  webServer: [
    {
      name: "Frontend",
      cwd: "..",
      command: "npm run dev -w=client",
      reuseExistingServer: !process.env.CI,
      url: "http://localhost:4530",
    },
    {
      name: "Server",
      cwd: "..",
      command: "npm run dev -w=server",
      reuseExistingServer: !process.env.CI,
      url: "http://localhost:8000",
    },
  ],
});
