import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { getDb } from "@/lib/db";
import { publicVisibility } from "@/services/catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!site.indexable) return [];
  const [categories, templates] = await Promise.all([
    getDb().eventCategory.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      take: 1000,
      orderBy: { slug: "asc" },
    }),
    getDb().template.findMany({
      where: publicVisibility,
      select: { slug: true, updatedAt: true },
      take: 48000,
      orderBy: { slug: "asc" },
    }),
  ]);
  return [
    ...["", "/templates", "/categories", "/about", "/privacy", "/terms"].map(
      (path) => ({ url: new URL(path || "/", site.url).href }),
    ),
    ...categories.map((category) => ({
      url: new URL(`/templates/category/${category.slug}`, site.url).href,
      lastModified: category.updatedAt,
    })),
    ...templates.map((template) => ({
      url: new URL(`/template/${template.slug}`, site.url).href,
      lastModified: template.updatedAt,
    })),
  ];
}
