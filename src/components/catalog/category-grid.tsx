import Link from "next/link";
import type { EventCategory } from "@prisma/client";
import { CatalogImage } from "./catalog-image";
export function CategoryGrid({ categories }: { categories: EventCategory[] }) {
  if (!categories.length)
    return (
      <p className="rounded-xl border border-dashed border-forest/20 p-8 text-forest/70">
        Our celebration collection is being prepared. Please check back soon.
      </p>
    );
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {categories.map((category) => (
        <Link
          href={`/templates/category/${category.slug}`}
          key={category.id}
          className="group overflow-hidden rounded-2xl border border-forest/10 bg-white transition hover:border-forest/40"
        >
          <div className="relative h-32 overflow-hidden bg-[#ede9df]">
            <CatalogImage
              src={category.imageUrl}
              alt=""
              className="h-full w-full object-cover object-[center_40%] opacity-90 transition duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex items-center justify-between gap-2 p-4">
            <h3 className="break-words text-sm font-semibold">
              {category.name}
            </h3>
            <span aria-hidden="true" className="text-xl text-[#a16d47]">
              {category.icon || "✧"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
