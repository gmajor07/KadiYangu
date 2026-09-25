import { describe, expect, it } from "vitest";
import {
  categorySchema,
  templateSchema,
  parseCatalogFilters,
} from "@/lib/validation/catalog";
import { formatTemplatePrice } from "@/lib/catalog/money";
import { isSafeImagePath } from "@/lib/catalog/images";
const category = {
  name: "Wedding",
  slug: "wedding",
  description: "A wonderful celebration.",
  imageUrl: "",
  icon: "♡",
  sortOrder: "0",
  isActive: true,
};
const template = {
  name: "Royal Wedding",
  slug: "royal-wedding",
  description: "An elegant wedding invitation.",
  thumbnailUrl: "/demo/royal-gold.svg",
  previewImageUrl: "",
  categoryId: "category-id",
  isPremium: false,
  price: "",
  currency: "TZS",
  status: "DRAFT",
  isFeatured: false,
  isActive: true,
  orientation: "PORTRAIT",
  width: "1080",
  height: "1350",
};
describe("category validation", () => {
  it("normalizes optional fields and integer sort order", () => {
    expect(categorySchema.parse(category)).toMatchObject({
      imageUrl: null,
      sortOrder: 0,
    });
  });
  it("rejects unsafe or invalid slugs, fields and sort order", () => {
    for (const change of [
      { slug: "UPPER Case" },
      { slug: "../../admin" },
      { sortOrder: "1.5" },
      { sortOrder: "-1" },
      { role: "ADMIN" },
      { name: "" },
    ])
      expect(categorySchema.safeParse({ ...category, ...change }).success).toBe(
        false,
      );
  });
});
describe("image paths", () => {
  it("accepts scoped local image assets", () => {
    expect(isSafeImagePath("/demo/royal-gold.svg")).toBe(true);
    expect(isSafeImagePath("/images/catalog/invitation.webp")).toBe(true);
  });
  it("rejects external requests, protocols, traversal and query strings", () => {
    for (const path of [
      "https://example.com/a.jpg",
      "//evil.test/a.svg",
      "javascript:alert(1)",
      "data:image/svg+xml,evil",
      "/demo/../secret.svg",
      "/demo/%2e%2e/a.svg",
      "/demo/a.svg?x=1",
      "/api/auth/a.svg",
      "/demo/a.svg#x",
    ])
      expect(isSafeImagePath(path)).toBe(false);
  });
});
describe("template and pricing validation", () => {
  it("stores free templates with null price and integer dimensions", () => {
    expect(templateSchema.parse(template)).toMatchObject({
      price: null,
      width: 1080,
      height: 1350,
    });
    expect(formatTemplatePrice(false, null)).toBe("Free");
  });
  it("accepts whole-TZS premium prices", () => {
    expect(
      templateSchema.parse({ ...template, isPremium: true, price: "15000" })
        .price,
    ).toBe(15000);
    expect(formatTemplatePrice(true, 15000)).toBe("TZS 15,000");
  });
  it("rejects zero, negative, fractional, overflowing, missing and exponential premium prices", () => {
    for (const price of ["0", "-1", "1.5", "2147483648", "", null, "1e3", 1.2])
      expect(
        templateSchema.safeParse({ ...template, isPremium: true, price })
          .success,
      ).toBe(false);
  });
  it("rejects prices on free templates and unsupported currencies", () => {
    expect(
      templateSchema.safeParse({ ...template, price: "100" }).success,
    ).toBe(false);
    expect(
      templateSchema.safeParse({ ...template, currency: "USD" }).success,
    ).toBe(false);
  });
  it("validates orientation/dimensions and rejects injected design documents", () => {
    for (const change of [
      { width: "0" },
      { height: "9000" },
      { orientation: "SQUARE" },
      { orientation: "LANDSCAPE" },
      { status: "DELETED" },
      { designData: { elements: ["evil"] } },
    ])
      expect(templateSchema.safeParse({ ...template, ...change }).success).toBe(
        false,
      );
    expect(
      templateSchema.safeParse({
        ...template,
        orientation: "SQUARE",
        height: "1080",
      }).success,
    ).toBe(true);
  });
});
it("bounds and normalizes public query filters", () => {
  expect(
    parseCatalogFilters({
      q: [" flower ", "other"],
      page: "-1",
      tier: "admin",
      category: "../../secret",
      orientation: "other",
    }),
  ).toEqual({ q: "flower", page: 1, tier: "", category: "", orientation: "" });
});
