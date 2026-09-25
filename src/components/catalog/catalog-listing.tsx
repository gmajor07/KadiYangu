import { getActiveCategories, listPublicTemplates } from "@/services/catalog";
import type { CatalogFilters } from "@/lib/validation/catalog";
import { CatalogFilterForm, Pagination } from "./filters";
import { TemplateGrid } from "./template-card";
export async function CatalogListing({
  filters,
  path,
  fixedCategory = false,
}: {
  filters: CatalogFilters;
  path: string;
  fixedCategory?: boolean;
}) {
  const [categories, result] = await Promise.all([
    getActiveCategories(),
    listPublicTemplates(filters),
  ]);
  return (
    <>
      <CatalogFilterForm
        filters={filters}
        categories={categories}
        action={path}
        fixedCategory={fixedCategory}
      />
      <p className="mb-6 text-sm text-forest/70" role="status">
        {result.total} {result.total === 1 ? "design" : "designs"}
        {filters.q ? ` matching “${filters.q}”` : " to make your own"}
      </p>
      {result.templates.length ? (
        <TemplateGrid templates={result.templates} />
      ) : (
        <div className="rounded-2xl border border-dashed border-forest/20 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">No designs found just yet.</h2>
          <p className="mt-3 text-forest/70">
            Try another search or clear your filters. More celebrations are on
            the way.
          </p>
        </div>
      )}
      <Pagination
        page={result.page}
        pages={result.pages}
        filters={filters}
        path={path}
        fixedCategory={fixedCategory}
      />
    </>
  );
}
