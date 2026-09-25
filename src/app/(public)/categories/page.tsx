import { getActiveCategories } from "@/services/catalog";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { catalogMetadata } from "@/lib/catalog/metadata";
export const dynamic = "force-dynamic";
export const metadata = catalogMetadata(
  "Celebration categories",
  "Explore invitation designs for weddings, birthdays, send-offs, kitchen parties, graduations and life's special celebrations.",
  "/categories",
);
export default async function Categories() {
  const categories = await getActiveCategories();
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <p className="eyebrow">Every reason to gather</p>
      <h1 className="mt-4 font-serif text-5xl">What are we celebrating?</h1>
      <p className="mb-10 mt-5 max-w-xl leading-8 text-forest/70">
        Big milestones and little joys. Find the perfect place to begin your
        invitation.
      </p>
      <CategoryGrid categories={categories} />
    </section>
  );
}
