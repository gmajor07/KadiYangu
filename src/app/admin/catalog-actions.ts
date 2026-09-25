"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveCategory, saveTemplate } from "@/services/catalog-admin";
import type { CatalogFormState } from "@/types/catalog";
function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
function refreshCatalog() {
  revalidatePath("/", "layout");
}
export async function saveCategoryAction(
  _state: CatalogFormState,
  form: FormData,
): Promise<CatalogFormState> {
  const values = {
    name: text(form, "name"),
    slug: text(form, "slug"),
    description: text(form, "description"),
    imageUrl: text(form, "imageUrl"),
    icon: text(form, "icon"),
    sortOrder: text(form, "sortOrder"),
    isActive: form.get("isActive") === "on",
  };
  const result = await saveCategory(values, text(form, "id") || undefined);
  if (!result.ok) return { ...result.state, values };
  refreshCatalog();
  redirect("/admin/categories?saved=1");
}
export async function saveTemplateAction(
  _state: CatalogFormState,
  form: FormData,
): Promise<CatalogFormState> {
  const values = {
    name: text(form, "name"),
    slug: text(form, "slug"),
    description: text(form, "description"),
    thumbnailUrl: text(form, "thumbnailUrl"),
    previewImageUrl: text(form, "previewImageUrl"),
    categoryId: text(form, "categoryId"),
    isPremium: form.get("isPremium") === "on",
    price: text(form, "price"),
    currency: text(form, "currency"),
    status: text(form, "status"),
    isFeatured: form.get("isFeatured") === "on",
    isActive: form.get("isActive") === "on",
    orientation: text(form, "orientation"),
    width: text(form, "width"),
    height: text(form, "height"),
  };
  const result = await saveTemplate(values, text(form, "id") || undefined);
  if (!result.ok) return { ...result.state, values };
  refreshCatalog();
  redirect("/admin/templates?saved=1");
}
