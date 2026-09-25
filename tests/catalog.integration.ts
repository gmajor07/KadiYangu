import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: () => Promise.resolve({ role: "ADMIN", status: "ACTIVE" }),
}));
import { getDb } from "@/lib/db";
import { saveCategory, saveTemplate } from "@/services/catalog-admin";
import {
  listPublicTemplates,
  getPublicTemplate,
  getPublicCategory,
} from "@/services/catalog";
import { parseCatalogFilters } from "@/lib/validation/catalog";
it("persists the catalog and enforces public visibility, filters, uniqueness and DB pricing constraints", async () => {
  if (
    process.env.ALLOW_TEST_DATABASE !== "true" ||
    !process.env.DATABASE_URL?.includes("kadiyangu_phase1_test")
  )
    throw new Error("Use only the isolated test database");
  const db = getDb();
  const prefix = `test-${randomUUID()}`;
  const ids: string[] = [];
  try {
    const cat = {
      name: prefix,
      slug: prefix,
      description: "Integration test celebration.",
      imageUrl: "",
      icon: "",
      sortOrder: "0",
      isActive: true,
    };
    const first = await saveCategory(cat);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("Category not created");
    ids.push(first.id);
    expect((await saveCategory(cat)).ok).toBe(false);
    const hidden = await db.eventCategory.create({
      data: {
        name: prefix,
        slug: `${prefix}-hidden`,
        description: "Hidden category",
        isActive: false,
      },
    });
    ids.push(hidden.id);
    const base = {
      name: prefix,
      slug: `${prefix}-free`,
      description: "Integration test invitation.",
      thumbnailUrl: "/demo/floral.svg",
      previewImageUrl: "",
      categoryId: first.id,
      isPremium: false,
      price: "",
      currency: "TZS",
      status: "PUBLISHED",
      isFeatured: true,
      isActive: true,
      orientation: "PORTRAIT",
      width: "1080",
      height: "1350",
    };
    const free = await saveTemplate(base);
    expect(free.ok).toBe(true);
    if (!free.ok) throw new Error("Template not created");
    expect((await saveTemplate(base)).ok).toBe(false);
    const stored = await db.template.findUniqueOrThrow({
      where: { id: free.id },
    });
    expect(stored.designData).toEqual({
      version: 1,
      canvas: { width: 1080, height: 1350 },
      elements: [],
    });
    await saveTemplate({
      ...base,
      slug: `${prefix}-premium`,
      isPremium: true,
      price: "15000",
    });
    await saveTemplate({ ...base, slug: `${prefix}-draft`, status: "DRAFT" });
    await saveTemplate({
      ...base,
      slug: `${prefix}-archived`,
      status: "ARCHIVED",
    });
    await saveTemplate({
      ...base,
      slug: `${prefix}-inactive`,
      isActive: false,
    });
    await saveTemplate({
      ...base,
      slug: `${prefix}-hidden-category`,
      categoryId: hidden.id,
    });
    const filters = parseCatalogFilters({
      q: prefix.toUpperCase(),
      category: prefix,
    });
    expect((await listPublicTemplates(filters)).total).toBe(2);
    const freeList = await listPublicTemplates({ ...filters, tier: "free" });
    expect(freeList.total).toBe(1);
    expect(freeList.templates[0].price).toBeNull();
    const premium = await listPublicTemplates({ ...filters, tier: "premium" });
    expect(premium.total).toBe(1);
    expect(premium.templates[0].price).toBe(15000);
    expect(
      (await listPublicTemplates({ ...filters, orientation: "SQUARE" })).total,
    ).toBe(0);
    expect((await getPublicTemplate(base.slug))?.name).toBe(prefix);
    for (const suffix of ["draft", "archived", "inactive", "hidden-category"])
      expect(await getPublicTemplate(`${prefix}-${suffix}`)).toBeNull();
    expect(await getPublicCategory(hidden.slug)).toBeNull();
    await expect(
      db.template.update({
        where: { id: free.id },
        data: { isPremium: true, price: null },
      }),
    ).rejects.toThrow();
    await expect(
      db.template.update({ where: { id: free.id }, data: { price: 500 } }),
    ).rejects.toThrow();
    const change = await saveTemplate(
      { ...base, width: "1200", height: "1500", status: "ARCHIVED" },
      free.id,
    );
    expect(change.ok).toBe(true);
    expect(await getPublicTemplate(base.slug)).toBeNull();
    await saveCategory({ ...cat, isActive: false }, first.id);
    expect((await listPublicTemplates(filters)).total).toBe(0);
  } finally {
    await db.template.deleteMany({ where: { categoryId: { in: ids } } });
    await db.eventCategory.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}, 30000);
