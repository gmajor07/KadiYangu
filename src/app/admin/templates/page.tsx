import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import {
  parseCatalogFilters,
  type SearchParams,
} from "@/lib/validation/catalog";
import { formatTemplatePrice } from "@/lib/catalog/money";
import { AdminPagination } from "@/components/admin/list-pagination";
export const metadata = { title: "Manage templates" };
export default async function TemplatesAdmin({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const { page } = parseCatalogFilters(params);
  const [templates, total] = await Promise.all([
    getDb().template.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 30,
      skip: (page - 1) * 30,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isActive: true,
        isPremium: true,
        price: true,
        currency: true,
        isFeatured: true,
        category: { select: { name: true, isActive: true } },
      },
    }),
    getDb().template.count(),
  ]);
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold">Invitation templates</h1>
          <p className="mt-3 text-sm text-forest/70">
            Only published, active templates in active categories appear
            publicly.
          </p>
        </div>
        <Link
          href="/admin/templates/new"
          className="rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white"
        >
          Add template
        </Link>
      </div>
      {params.saved === "1" && (
        <p role="status" className="mt-5 rounded-xl bg-forest/10 p-4 text-sm">
          Template saved.
        </p>
      )}
      <div className="mt-8 space-y-3">
        {templates.map((template) => (
          <article
            key={template.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-forest/15 bg-white p-5"
          >
            <div className="min-w-0">
              <h2 className="break-words font-semibold">
                {template.name}
                {template.isFeatured && (
                  <span className="ml-2 text-xs text-[#805b38]">Featured</span>
                )}
              </h2>
              <p className="mt-1 text-xs text-forest/65">
                {template.category.name} ·{" "}
                {formatTemplatePrice(
                  template.isPremium,
                  template.price,
                  template.currency,
                )}
              </p>
              <p className="mt-1 text-xs text-forest/65">
                {template.status} · {template.isActive ? "Active" : "Inactive"}
                {!template.category.isActive && " · Category hidden"}
              </p>
            </div>
            <Link
              className="text-sm font-semibold underline"
              href={`/admin/templates/${template.id}/edit`}
              aria-label={`Edit ${template.name}`}
            >
              Edit
            </Link>
          </article>
        ))}
        {!templates.length && (
          <p className="rounded-xl border border-dashed border-forest/20 p-8">
            No templates on this page. Add a category first, then create a
            template.
          </p>
        )}
      </div>
      <AdminPagination page={page} total={total} path="/admin/templates" />
    </section>
  );
}
