import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  site: { name: "KadiYangu", url: "https://example.test", indexable: false },
  categories: vi.fn(),
  templates: vi.fn(),
}));
vi.mock("@/config/site", () => ({ site: mocks.site }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    eventCategory: { findMany: mocks.categories },
    template: { findMany: mocks.templates },
  }),
}));
import sitemap from "@/app/sitemap";
import { catalogMetadata } from "@/lib/catalog/metadata";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.site.indexable = false;
});
it("keeps staging unindexed with an empty sitemap", async () => {
  expect(await sitemap()).toEqual([]);
  expect(mocks.categories).not.toHaveBeenCalled();
  expect(catalogMetadata("Design", "Description", "/templates").robots).toEqual(
    { index: false, follow: false },
  );
});
it("provides canonical metadata while excluding filtered URLs from indexing", () => {
  mocks.site.indexable = true;
  const metadata = catalogMetadata(
    "Wedding",
    "Description",
    "/templates/category/wedding",
    true,
  );
  expect(metadata.alternates?.canonical).toBe("/templates/category/wedding");
  expect(metadata.robots).toEqual({ index: false, follow: true });
  expect(
    catalogMetadata("Wedding", "Description", "/template/gold").robots,
  ).toEqual({ index: true, follow: true });
});
it("adds only eligible category/template entries when indexing is explicitly enabled", async () => {
  mocks.site.indexable = true;
  const updatedAt = new Date("2026-09-21T00:00:00Z");
  mocks.categories.mockResolvedValue([{ slug: "wedding", updatedAt }]);
  mocks.templates.mockResolvedValue([
    { slug: "royal-gold-wedding", updatedAt },
  ]);
  const entries = await sitemap();
  expect(entries.map((entry) => entry.url)).toContain(
    "https://example.test/templates/category/wedding",
  );
  expect(entries.map((entry) => entry.url)).toContain(
    "https://example.test/template/royal-gold-wedding",
  );
  expect(mocks.templates).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: "PUBLISHED",
        isActive: true,
        category: { isActive: true },
      },
    }),
  );
  expect(
    entries.some(
      (entry) => entry.url.includes("/admin") || entry.url.includes("?"),
    ),
  ).toBe(false);
});
