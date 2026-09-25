"use server";
import { requireUser } from "@/lib/auth/guards";
import { archiveOwnedDesign, duplicateOwnedDesign } from "@/services/designs";
import { revalidatePath } from "next/cache";
export async function duplicateDesignAction(formData:FormData){const u=await requireUser();await duplicateOwnedDesign(u.id,String(formData.get("id")));revalidatePath("/dashboard/designs")}
export async function archiveDesignAction(formData:FormData){const u=await requireUser();await archiveOwnedDesign(u.id,String(formData.get("id")));revalidatePath("/dashboard/designs")}
