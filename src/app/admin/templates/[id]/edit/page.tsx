import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { CatalogForm } from "@/components/admin/catalog-form";
export const metadata = { title: "Edit template" };
export default async function EditTemplate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const [template, categories] = await Promise.all([
    getDb().template.findUnique({ where: { id: (await params).id } }),
    getDb().eventCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
  ]);
  if (!template) notFound();
  const {
    id,
    name,
    slug,
    description,
    thumbnailUrl,
    previewImageUrl,
    categoryId,
    isPremium,
    price,
    currency,
    status,
    isFeatured,
    isActive,
    orientation,
    width,
    height,
  } = template;
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Edit invitation template</h1>
      <CatalogForm
        kind="template"
        categories={categories}
        initial={{
          id,
          name,
          slug,
          description,
          thumbnailUrl,
          previewImageUrl,
          categoryId,
          isPremium,
          price,
          currency,
          status,
          isFeatured,
          isActive,
          orientation,
          width,
          height,
        }}
      />
    </section>
  );
}
