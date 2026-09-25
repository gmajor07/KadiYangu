import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import {
  parseCatalogFilters,
  type SearchParams,
} from "@/lib/validation/catalog";
import { AdminPagination } from "@/components/admin/list-pagination";
export const metadata = { title: "Manage categories" };
export default async function CategoriesAdmin({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const { page } = parseCatalogFilters(params);
  const [categories, total] = await Promise.all([
    getDb().eventCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 30,
      skip: (page - 1) * 30,
      include: { _count: { select: { templates: true } } },
    }),
    getDb().eventCategory.count(),
  ]);
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold">Event categories</h1>
          <p className="mt-3 text-sm text-forest/70">
            Inactive categories hide all their templates from public discovery.
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white"
        >
          Add category
        </Link>
      </div>
      {params.saved === "1" && (
        <p role="status" className="mt-5 rounded-xl bg-forest/10 p-4 text-sm">
          Category saved.
        </p>
      )}
      <div className="mt-8 space-y-3">
        {categories.map((category) => (
          <article
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-forest/15 bg-white p-5"
          >
            <div className="min-w-0">
              <h2 className="break-words font-semibold">{category.name}</h2>
              <p className="mt-1 break-all text-xs text-forest/65">
                /{category.slug} · Order {category.sortOrder} ·{" "}
                {category._count.templates} templates
              </p>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span>{category.isActive ? "Active" : "Inactive"}</span>
              <Link
                className="font-semibold underline"
                href={`/admin/categories/${category.id}/edit`}
                aria-label={`Edit ${category.name}`}
              >
                Edit
              </Link>
            </div>
          </article>
        ))}
        {!categories.length && (
          <p className="rounded-xl border border-dashed border-forest/20 p-8">
            No categories on this page. Add your first celebration category.
          </p>
        )}
      </div>
      <AdminPagination page={page} total={total} path="/admin/categories" />
    </section>
  );
}
