import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  template: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  eventCategory: { findMany: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ getDb: () => db }));
import {
  getPublicTemplate,
  listPublicTemplates,
  templateWhere,
  getFeaturedTemplates,
  getPublicCategory,
} from "@/services/catalog";
import { parseCatalogFilters } from "@/lib/validation/catalog";
beforeEach(() => {
  vi.resetAllMocks();
  db.template.count.mockResolvedValue(1);
  db.template.findMany.mockResolvedValue([]);
});
it("always requires published, active templates and categories", () => {
  expect(templateWhere(parseCatalogFilters({}))).toEqual({
    status: "PUBLISHED",
    isActive: true,
    category: { isActive: true },
  });
});
it("combines search, category, tier, orientation and pagination safely", async () => {
  await listPublicTemplates(
    parseCatalogFilters({
      q: "Rose",
      category: "wedding",
      tier: "free",
      orientation: "PORTRAIT",
      page: "1000",
    }),
  );
  expect(db.template.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: "PUBLISHED",
        isActive: true,
        category: { isActive: true, slug: "wedding" },
        name: { contains: "Rose", mode: "insensitive" },
        isPremium: false,
        orientation: "PORTRAIT",
      },
      take: 12,
      skip: 0,
    }),
  );
});
it("filters premium designs and returns bounded page information", async () => {
  db.template.count.mockResolvedValue(30);
  const result = await listPublicTemplates(
    parseCatalogFilters({ tier: "premium", page: "2" }),
  );
  expect(result).toMatchObject({ total: 30, page: 2, pages: 3 });
  expect(db.template.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ isPremium: true }),
      skip: 12,
    }),
  );
});
it("protects detail and featured lookups with the same visibility rules", async () => {
  await getPublicTemplate("draft-design");
  expect(db.template.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: "PUBLISHED",
        isActive: true,
        category: { isActive: true },
        slug: "draft-design",
      },
    }),
  );
  await getFeaturedTemplates();
  expect(db.template.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ isFeatured: true, status: "PUBLISHED" }),
    }),
  );
  await getPublicCategory("hidden");
  expect(db.eventCategory.findFirst).toHaveBeenCalledWith({
    where: { slug: "hidden", isActive: true },
  });
});
