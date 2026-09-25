import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { CatalogForm } from "@/components/admin/catalog-form";
export const metadata = { title: "Add template" };
export default async function NewTemplate() {
  await requireAdmin();
  const categories = await getDb().eventCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Add invitation template</h1>
      {categories.length ? (
        <CatalogForm kind="template" categories={categories} />
      ) : (
        <p className="mt-6">
          Create a category before adding a template.{" "}
          <Link href="/admin/categories/new" className="underline">
            Add category
          </Link>
        </p>
      )}
    </section>
  );
}
