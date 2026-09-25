import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { mkdir } from "node:fs/promises";
if (
  process.env.ALLOW_TEST_DATABASE !== "true" ||
  !process.env.DATABASE_URL?.includes("/kadiyangu_phase1_test")
)
  throw new Error(
    "E2E requires the dedicated test database; run with scripts/with-test-db.cjs",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const suffix = randomUUID().slice(0, 8);
const adminId = randomUUID();
const adminEmail = `admin-${suffix}@example.test`;
const userEmail = `user-${suffix}@example.test`;
const password = randomBytes(20).toString("hex");
const categorySlug = `browser-${suffix}`;
const templateSlug = `browser-design-${suffix}`;
const browserErrors: string[] = [];
test.beforeAll(async () => {
  const salt = randomBytes(16).toString("hex");
  const hash = `scrypt-v1$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 67108864 }).toString("hex")}`;
  await pool.query(
    'INSERT INTO "User" (id,name,email,"passwordHash",role,"updatedAt") VALUES ($1,$2,$3,$4,\'ADMIN\',NOW())',
    [adminId, "Catalog Test Admin", adminEmail, hash],
  );
  await mkdir("docs/screenshots/phase2", { recursive: true });
});
test.afterAll(async () => {
  await pool.query('DELETE FROM "Template" WHERE slug=$1', [templateSlug]);
  await pool.query('DELETE FROM "EventCategory" WHERE slug=$1', [categorySlug]);
  await pool.query('DELETE FROM "User" WHERE email=ANY($1::text[])', [
    [adminEmail, userEmail],
  ]);
  await pool.end();
});
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => browserErrors.push(error.message));
});

async function prepareScreenshot(page: Page) {
  // Scroll as a visitor does so lazy images are loaded before full-page captures.
  for (const img of await page.locator("img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
for (const [label, width, height] of [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`public discovery works on ${label} without overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Beautiful invitations/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Wedding", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await prepareScreenshot(page);
    await page.screenshot({
      path: `docs/screenshots/phase2/home-${label}.png`,
      fullPage: true,
    });
    await page.goto("/templates");
    await expect(
      page.getByRole("heading", { name: "Royal Gold Wedding", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await prepareScreenshot(page);
    await page.screenshot({
      path: `docs/screenshots/phase2/templates-${label}.png`,
      fullPage: true,
    });
    if (label === "mobile") {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto("/");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
}

test("search, category, free/premium, format, clear and empty states work", async ({
  page,
}) => {
  await page.goto("/templates");
  await page.getByLabel("Celebration", { exact: true }).selectOption("wedding");
  await page.getByLabel("Price", { exact: true }).selectOption("free");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Elegant Floral Wedding", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Royal Gold Wedding", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.getByLabel("Find your design").fill("Royal");
  await page.getByLabel("Price", { exact: true }).selectOption("premium");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("TZS 15,000", { exact: true })).toBeVisible();
  await page.getByLabel("Find your design").fill("no-matching-invitation");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No designs found just yet." }),
  ).toBeVisible();
  await page.goto("/templates?orientation=LANDSCAPE");
  await expect(
    page.getByRole("heading", { name: "Graduation Classic", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Modern Birthday", exact: true }),
  ).toHaveCount(0);
  await page.goto("/templates/category/wedding?tier=premium");
  await expect(
    page.getByRole("heading", { name: "Wedding invitations", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Royal Gold Wedding", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Elegant Floral Wedding", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/templates\/category\/wedding$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await prepareScreenshot(page);
  await page.screenshot({
    path: "docs/screenshots/phase2/category-wedding.png",
    fullPage: true,
  });
});

test("detail preview is honest about the editor and unknown slugs are unavailable", async ({
  page,
}) => {
  await page.goto("/template/royal-gold-wedding");
  await expect(
    page.getByRole("heading", { name: "Royal Gold Wedding", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TZS 15,000", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Customize This Template" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Card editor coming in the next phase" }),
  ).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Royal Gold Wedding | KadiYangu",
  );
  await prepareScreenshot(page);
  await page.screenshot({
    path: "docs/screenshots/phase2/template-detail.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await prepareScreenshot(page);
  await page.screenshot({
    path: "docs/screenshots/phase2/template-detail-mobile.png",
    fullPage: true,
  });
  await page.goto("/template/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not available." }),
  ).toBeVisible();
});

test("Phase 1 registration/login/logout and USER admin denial remain functional", async ({
  page,
}) => {
  await page.goto("/admin/templates");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Catalog Test User");
  await page.getByLabel("Email address").fill(userEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("your account is ready");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(userEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Your account is ready." }),
  ).toBeVisible();
  for (const path of [
    "/admin",
    "/admin/categories",
    "/admin/templates",
    "/admin/categories/new",
    "/admin/templates/new",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Page not available." }),
    ).toBeVisible();
  }
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("admin creates and edits categories/templates and controls public visibility", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill("Browser Celebration");
  await page.getByLabel("URL slug").fill(categorySlug);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A celebration created through the real admin form.");
  await page.getByLabel("Sort order").fill("99");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page).toHaveURL(/\/admin\/categories\?saved=1/);
  const categoryId = (
    await pool.query('SELECT id FROM "EventCategory" WHERE slug=$1', [
      categorySlug,
    ])
  ).rows[0].id;
  await page.goto("/admin/templates/new");
  await page.getByLabel("Name", { exact: true }).fill("Browser Invitation");
  await page.getByLabel("URL slug").fill(templateSlug);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A template created through the real admin form.");
  await page.getByLabel("Category", { exact: true }).selectOption(categoryId);
  await page.getByLabel("Premium design").check();
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(
    page.getByText("Premium templates require a positive whole-TZS price."),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Browser Invitation",
  );
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    categoryId,
  );
  await page.getByLabel("Price in whole TZS").fill("12000");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page).toHaveURL(/\/admin\/templates\?saved=1/);
  const templateId = (
    await pool.query('SELECT id FROM "Template" WHERE slug=$1', [templateSlug])
  ).rows[0].id;
  await page.goto(`/template/${templateSlug}`);
  await expect(
    page.getByRole("heading", { name: "Page not available." }),
  ).toBeVisible();
  await page.goto(`/admin/templates/${templateId}/edit`);
  await page.getByLabel("Publication status").selectOption("PUBLISHED");
  await page.getByLabel(/Featured —/).check();
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page).toHaveURL(/saved=1/);
  await page.goto(`/template/${templateSlug}`);
  await expect(
    page.getByRole("heading", { name: "Browser Invitation", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TZS 12,000", { exact: true })).toBeVisible();
  await page.goto(`/admin/templates/${templateId}/edit`);
  await prepareScreenshot(page);
  await page.screenshot({
    path: "docs/screenshots/phase2/admin-template-edit.png",
    fullPage: true,
  });
  await page.getByLabel("Premium design").uncheck();
  await page.getByLabel("Price in whole TZS").fill("");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page).toHaveURL(/saved=1/);
  expect(
    (
      await pool.query('SELECT "isPremium",price FROM "Template" WHERE id=$1', [
        templateId,
      ])
    ).rows[0],
  ).toEqual({ isPremium: false, price: null });
  await page.goto(`/admin/categories/${categoryId}/edit`);
  await page.getByLabel(/^Active —/).uncheck();
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page).toHaveURL(/saved=1/);
  await page.goto(`/template/${templateSlug}`);
  await expect(
    page.getByRole("heading", { name: "Page not available." }),
  ).toBeVisible();
  await page.goto(`/admin/categories/${categoryId}/edit`);
  await page.getByLabel(/^Active —/).check();
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page).toHaveURL(/saved=1/);
  await page.goto(`/admin/templates/${templateId}/edit`);
  await page.getByLabel("Publication status").selectOption("ARCHIVED");
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page).toHaveURL(/saved=1/);
  await page.goto(`/template/${templateSlug}`);
  await expect(
    page.getByRole("heading", { name: "Page not available." }),
  ).toBeVisible();
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name", { exact: true }).fill("Duplicate");
  await page.getByLabel("URL slug").fill(categorySlug);
  await page
    .getByLabel("Description", { exact: true })
    .fill("This duplicate should not save.");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page.locator("#main").getByRole("alert")).toContainText(
    "already in use",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // A form loaded by an admin cannot save after that account loses its role.
  await pool.query('UPDATE "User" SET role = $1 WHERE id = $2', [
    "USER",
    adminId,
  ]);
  await page.getByLabel("URL slug").fill(`denied-${suffix}`);
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(
    page.getByRole("heading", { name: "Page not available." }),
  ).toBeVisible();
  expect(
    (
      await pool.query('SELECT id FROM "EventCategory" WHERE slug=$1', [
        `denied-${suffix}`,
      ])
    ).rowCount,
  ).toBe(0);
  expect(browserErrors).toEqual([]);
});
