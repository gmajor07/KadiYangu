"use server";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { putImage } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
const types: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" };
export async function createHeroSlide(form: FormData) {
  await requireAdmin(); const file = form.get("file"); const altText = String(form.get("altText")||"").trim().slice(0,200); const sortOrder = Number(form.get("sortOrder")||0);
  if (!(file instanceof File) || !types[file.type] || file.size < 1 || file.size > 5*1024*1024 || !altText || !Number.isInteger(sortOrder)) redirect("/admin/hero-slides?error=invalid");
  const stored = await putImage("hero", file);
  await getDb().heroSlide.create({data:{imageUrl:stored.url,altText,sortOrder,isActive:true}}); revalidatePath("/"); revalidatePath("/admin/hero-slides"); redirect("/admin/hero-slides?saved=1");
}
export async function updateHeroSlide(form: FormData) { await requireAdmin(); const id=String(form.get("id")); const sortOrder=Number(form.get("sortOrder")); const altText=String(form.get("altText")||"").trim().slice(0,200); if(!id||!altText||!Number.isInteger(sortOrder)) redirect("/admin/hero-slides?error=invalid"); await getDb().heroSlide.update({where:{id},data:{sortOrder,altText,isActive:form.get("isActive")==="on"}}); revalidatePath("/"); revalidatePath("/admin/hero-slides"); }
export async function deleteHeroSlide(form: FormData) { await requireAdmin(); const id=String(form.get("id")); if(id) await getDb().heroSlide.delete({where:{id}}); revalidatePath("/"); revalidatePath("/admin/hero-slides"); }
