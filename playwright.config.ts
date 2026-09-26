import { defineConfig } from "@playwright/test";
const port = process.env.TEST_PORT || "3102";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `PORT=${port} node .next/standalone/server.js`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
