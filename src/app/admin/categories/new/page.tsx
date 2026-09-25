import { requireAdmin } from "@/lib/auth/guards";
import { CatalogForm } from "@/components/admin/catalog-form";
export const metadata = { title: "Add category" };
export default async function NewCategory() {
  await requireAdmin();
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Add event category</h1>
      <CatalogForm kind="category" />
    </section>
  );
}
