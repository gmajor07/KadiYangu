"use server";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { putImage, MAX_IMAGE_BYTES } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
const types = ["image/jpeg", "image/png", "image/webp"];
function target(form: FormData) {
  const placement = form.get("placement") === "BACKGROUND" ? "BACKGROUND" : "CARD";
  return { placement, path: placement === "BACKGROUND" ? "/admin/homepage-backgrounds" : "/admin/hero-slides" };
}
function details(form: FormData) {
  const altText = String(form.get("altText") || "").trim();
  const sortOrder = Number(form.get("sortOrder") || 0);
  return { altText, sortOrder, valid: altText.length > 0 && altText.length <= 200 && Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= 2147483647 };
}
function refresh(path: string) { revalidatePath("/"); revalidatePath(path); }
export async function createHeroSlide(form: FormData) {
  await requireAdmin();
  const {placement,path} = target(form);
  const {altText,sortOrder,valid} = details(form);
  const file = form.get("file");
  if (!valid || !(file instanceof File) || !types.includes(file.type) || file.size < 1 || file.size > MAX_IMAGE_BYTES) redirect(`${path}?error=invalid`);
  let stored;
  try { stored = await putImage(placement === "BACKGROUND" ? "homepage-backgrounds" : "hero",file); }
  catch { redirect(`${path}?error=upload`); }
  await getDb().heroSlide.create({data:{placement,imageUrl:stored.url,altText,sortOrder,isActive:true}});
  refresh(path); redirect(`${path}?saved=added`);
}
export async function updateHeroSlide(form: FormData) {
  await requireAdmin();
  const {placement,path} = target(form);
  const {altText,sortOrder,valid} = details(form);
  const id = String(form.get("id") || "");
  if (!id || !valid) redirect(`${path}?error=invalid`);
  await getDb().heroSlide.updateMany({where:{id,placement},data:{sortOrder,altText,isActive:form.get("isActive") === "on"}});
  refresh(path); redirect(`${path}?saved=updated`);
}
export async function deleteHeroSlide(form: FormData) {
  await requireAdmin();
  const {placement,path} = target(form);
  const id = String(form.get("id") || "");
  if (id) await getDb().heroSlide.deleteMany({where:{id,placement}});
  refresh(path); redirect(`${path}?saved=deleted`);
}
