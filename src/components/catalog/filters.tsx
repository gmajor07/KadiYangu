import Link from "next/link";
import type { CatalogFilters } from "@/lib/validation/catalog";
export function CatalogFilterForm({
  filters,
  categories,
  action,
  fixedCategory = false,
}: {
  filters: CatalogFilters;
  categories: { slug: string; name: string }[];
  action: string;
  fixedCategory?: boolean;
}) {
  return (
    <form
      action={action}
      method="get"
      className="mb-8 grid items-end gap-4 rounded-2xl border border-forest/10 bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">
        <label htmlFor="search">Find your design</label>
        <input
          id="search"
          name="q"
          type="search"
          placeholder="Search invitations…"
          maxLength={100}
          defaultValue={filters.q}
        />
      </div>
      {!fixedCategory && (
        <div>
          <label htmlFor="category">Celebration</label>
          <select id="category" name="category" defaultValue={filters.category}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="tier">Price</label>
        <select id="tier" name="tier" defaultValue={filters.tier}>
          <option value="">Free & premium</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </div>
      <div>
        <label htmlFor="orientation">Format</label>
        <select
          id="orientation"
          name="orientation"
          defaultValue={filters.orientation}
        >
          <option value="">All formats</option>
          <option value="PORTRAIT">Portrait</option>
          <option value="LANDSCAPE">Landscape</option>
          <option value="SQUARE">Square</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-[#236658]"
          type="submit"
        >
          Apply
        </button>
        <Link href={action} className="text-xs underline underline-offset-4">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
export function Pagination({
  page,
  pages,
  filters,
  path,
  fixedCategory = false,
}: {
  page: number;
  pages: number;
  filters: CatalogFilters;
  path: string;
  fixedCategory?: boolean;
}) {
  if (pages < 2) return null;
  const href = (number: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (key !== "page" && value && !(fixedCategory && key === "category"))
        query.set(key, String(value));
    query.set("page", String(number));
    return `${path}?${query}`;
  };
  return (
    <nav
      aria-label="Template pagination"
      className="mt-10 flex items-center justify-center gap-6 text-sm"
    >
      {page > 1 && (
        <Link className="underline" href={href(page - 1)}>
          ← Previous
        </Link>
      )}
      <span aria-current="page">
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link className="underline" href={href(page + 1)}>
          Next →
        </Link>
      )}
    </nav>
  );
}
