import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { CatalogForm } from "@/components/admin/catalog-form";
export const metadata = { title: "Edit category" };
export default async function EditCategory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const category = await getDb().eventCategory.findUnique({
    where: { id: (await params).id },
  });
  if (!category) notFound();
  const { id, name, slug, description, imageUrl, icon, sortOrder, isActive } =
    category;
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Edit event category</h1>
      <CatalogForm
        kind="category"
        initial={{
          id,
          name,
          slug,
          description,
          imageUrl,
          icon,
          sortOrder,
          isActive,
        }}
      />
    </section>
  );
}
