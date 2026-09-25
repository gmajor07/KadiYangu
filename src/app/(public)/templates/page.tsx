import { CatalogListing } from "@/components/catalog/catalog-listing";
import { AdSlot } from "@/components/catalog/ad-slot";
import {
  parseCatalogFilters,
  type SearchParams,
} from "@/lib/validation/catalog";
import { catalogMetadata } from "@/lib/catalog/metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseCatalogFilters(await searchParams);
  return catalogMetadata(
    "Invitation templates",
    "Browse free and premium invitation templates for weddings, birthdays, send-offs and more. Find your celebration’s perfect design.",
    "/templates",
    !!(
      filters.q ||
      filters.category ||
      filters.tier ||
      filters.orientation ||
      filters.page > 1
    ),
  );
}
export default async function Templates({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseCatalogFilters(await searchParams);
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <p className="eyebrow">The invitation collection</p>
      <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
        Your moment. Your kind of beautiful.
      </h1>
      <p className="mb-9 mt-4 max-w-2xl leading-7 text-forest/70">
        Find an invitation that sets the mood. Explore by celebration, style and
        budget.
      </p>
      <CatalogListing filters={filters} path="/templates" />
      <AdSlot placement="catalog-bottom" />
    </section>
  );
}
