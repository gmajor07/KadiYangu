"use server";
import { requireAdmin } from "@/lib/auth/guards"; import { getDb } from "@/lib/db"; import { revalidatePath } from "next/cache";
export async function updateFeedbackStatus(form:FormData){await requireAdmin();const id=String(form.get("id"));const status=String(form.get("status"));if(!["OPEN","REVIEWED","RESOLVED"].includes(status))return;await getDb().feedback.update({where:{id},data:{status,reviewedAt:status==="OPEN"?null:new Date()}});revalidatePath("/admin/feedback");}
