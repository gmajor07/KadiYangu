import "server-only";
import { getDb } from "@/lib/db";
export function getActiveHeroSlides() { return getDb().heroSlide.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, altText: true } }); }
