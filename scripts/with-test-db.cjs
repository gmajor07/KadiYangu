/* eslint-disable @typescript-eslint/no-require-imports -- Local test command runner. */
// Explicitly redirects commands to the dedicated local integration database.
require("dotenv").config({ quiet: true });
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (!["localhost", "127.0.0.1"].includes(database.hostname)) {
  throw new Error("Test commands require a local PostgreSQL server.");
}
database.pathname = "/kadiyangu_phase1_test";
const [command, ...args] = process.argv.slice(2);
if (!command)
  throw new Error("Provide a test command, e.g. npm run test:integration");
const port = process.env.TEST_PORT || "3102";
const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: database.href,
    ALLOW_TEST_DATABASE: "true",
    KADI_TEST_BUILD: "true",
    AUTH_SECRET: process.env.AUTH_SECRET || randomBytes(48).toString("base64"),
    NEXTAUTH_URL: `http://localhost:${port}`,
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
    SMOKE_URL: `http://localhost:${port}`,
    SITE_INDEXABLE: "false",
  },
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => {
  console.error("Could not start test command");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
