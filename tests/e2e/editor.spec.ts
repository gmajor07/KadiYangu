import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdir } from "node:fs/promises";

if (process.env.ALLOW_TEST_DATABASE !== "true" || !process.env.DATABASE_URL?.includes("kadiyangu_phase1_test")) throw new Error("Editor E2E requires the isolated test database.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const suffix = randomUUID().slice(0, 8); const password = randomBytes(20).toString("hex");
const emailA = `editor-a-${suffix}@example.test`; const emailB = `editor-b-${suffix}@example.test`; let designId = "";
async function hash(value: string) { const salt = randomBytes(16).toString("hex"); return `scrypt-v1$${salt}$${scryptSync(value, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 67108864 }).toString("hex")}`; }
async function login(page: import("@playwright/test").Page, email: string) { await page.getByLabel("Email address").fill(email); await page.getByLabel("Password", { exact: true }).fill(password); await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/dashboard|editor/); }
test.beforeAll(async () => { await mkdir("docs/screenshots/phase3", { recursive: true }); const passwordHash = await hash(password); await pool.query('INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW()),($5,$6,$7,$4,NOW())', [randomUUID(), "Editor A", emailA, passwordHash, randomUUID(), "Editor B", emailB]); });
test.afterAll(async () => { await pool.query('DELETE FROM "Design" WHERE id=$1', [designId]); await pool.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [[emailA, emailB]]); await pool.end(); });

test("desktop customization saves and reopens a design", async ({ page }) => {
  await page.goto("/template/royal-gold-wedding"); await page.getByRole("button", { name: "Customize This Template" }).click(); await expect(page).toHaveURL(/login\?callbackUrl=/); await login(page, emailA); await expect(page).toHaveURL(/\/editor\//);
  designId = page.url().split("/").pop()!; await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/phase3/editor-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "＋ Text" }).click(); await page.getByLabel("Design name").fill("My Wedding Card"); await page.getByRole("button", { name: "Save" }).click(); await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByLabel("Design name")).toHaveValue("My Wedding Card"); await page.goto("/dashboard/designs"); await expect(page.getByText("My Wedding Card", { exact: true })).toBeVisible();
});

test("mobile editor fits and another user cannot access the design", async ({ page }) => {
  test.skip(!designId, "The desktop editor test must create the design first.");
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/login"); await login(page, emailB); await page.goto(`/editor/${designId}`); await expect(page.getByRole("heading", { name: "Page not available." })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: "docs/screenshots/phase3/editor-mobile-security.png", fullPage: true });
});
