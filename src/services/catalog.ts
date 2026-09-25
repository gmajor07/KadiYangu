import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import type { CatalogFilters } from "@/lib/validation/catalog";
export const publicVisibility = {
  status: "PUBLISHED",
  isActive: true,
  category: { isActive: true },
} satisfies Prisma.TemplateWhereInput;
export const publicTemplateSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  thumbnailUrl: true,
  previewImageUrl: true,
  isPremium: true,
  price: true,
  currency: true,
  orientation: true,
  width: true,
  height: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.TemplateSelect;
export type CatalogTemplate = Prisma.TemplateGetPayload<{
  select: typeof publicTemplateSelect;
}>;
export const getActiveCategories = cache(() =>
  getDb().eventCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  }),
);
export const getPublicCategory = cache((slug: string) =>
  getDb().eventCategory.findFirst({ where: { slug, isActive: true } }),
);
export const getPublicTemplate = cache((slug: string) =>
  getDb().template.findFirst({
    where: { ...publicVisibility, slug },
    select: publicTemplateSelect,
  }),
);
export function templateWhere(
  filters: CatalogFilters,
): Prisma.TemplateWhereInput {
  return {
    ...publicVisibility,
    category: {
      isActive: true,
      ...(filters.category ? { slug: filters.category } : {}),
    },
    ...(filters.q
      ? { name: { contains: filters.q, mode: "insensitive" } }
      : {}),
    ...(filters.tier ? { isPremium: filters.tier === "premium" } : {}),
    ...(filters.orientation ? { orientation: filters.orientation } : {}),
  };
}
export async function listPublicTemplates(filters: CatalogFilters) {
  const where = templateWhere(filters);
  const total = await getDb().template.count({ where });
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = Math.min(filters.page, pages);
  const templates = await getDb().template.findMany({
    where,
    select: publicTemplateSelect,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: 12,
    skip: (page - 1) * 12,
  });
  return { templates, total, page, pages };
}
export function getFeaturedTemplates() {
  return getDb().template.findMany({
    where: { ...publicVisibility, isFeatured: true },
    select: publicTemplateSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 4,
  });
}
