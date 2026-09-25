"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { updateOwnedDesign } from "@/services/designs";
export async function saveDesignAction(id:string, payload:{name:string;designData:unknown}) { const user=await requireUser(); const design=await updateOwnedDesign(user.id,id,payload); if(!design) return {ok:false,error:"Design not found."}; revalidatePath(`/editor/${id}`); revalidatePath("/dashboard/designs"); return {ok:true,updatedAt:design.updatedAt.toISOString()}; }
