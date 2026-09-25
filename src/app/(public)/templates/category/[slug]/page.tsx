import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicCategory } from "@/services/catalog";
import { CatalogListing } from "@/components/catalog/catalog-listing";
import { AdSlot } from "@/components/catalog/ad-slot";
import {
  parseCatalogFilters,
  type SearchParams,
} from "@/lib/validation/catalog";
import { catalogMetadata } from "@/lib/catalog/metadata";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const category = await getPublicCategory((await params).slug);
  if (!category) notFound();
  const filters = parseCatalogFilters(await searchParams);
  return catalogMetadata(
    `${category.name} invitation templates`,
    category.description,
    `/templates/category/${category.slug}`,
    !!(filters.q || filters.tier || filters.orientation || filters.page > 1),
  );
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getPublicCategory((await params).slug);
  if (!category) notFound();
  const filters = {
    ...parseCatalogFilters(await searchParams),
    category: category.slug,
  };
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="mb-7 text-xs text-forest/65">
        <Link href="/templates" className="underline">
          Templates
        </Link>
        <span aria-hidden="true"> / </span>
        {category.name}
      </nav>
      <p className="eyebrow">An invitation to celebrate</p>
      <h1 className="mt-4 font-serif text-5xl">{category.name} invitations</h1>
      <p className="mb-9 mt-4 max-w-2xl leading-8 text-forest/70">
        {category.description}
      </p>
      <CatalogListing
        filters={filters}
        path={`/templates/category/${category.slug}`}
        fixedCategory
      />
      <AdSlot placement="category-bottom" />
    </section>
  );
}
