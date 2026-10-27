import "server-only";
import { getDb } from "@/lib/db";
export function getActiveHeroSlides(placement: "CARD" | "BACKGROUND" = "CARD") { return getDb().heroSlide.findMany({ where: { isActive: true, placement }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, altText: true } }); }
