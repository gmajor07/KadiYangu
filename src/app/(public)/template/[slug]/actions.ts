"use server";
import { requireUser } from "@/lib/auth/guards";
import { createDesignFromTemplate } from "@/services/designs";
import { redirect } from "next/navigation";
export async function customizeTemplateAction(formData: FormData) { const slug=String(formData.get("slug")||""); const user=await requireUser(`/template/${slug}`); const { getDb }=await import("@/lib/db"); const template=await getDb().template.findFirst({where:{slug,status:"PUBLISHED",isActive:true},select:{id:true}}); if(!template) redirect("/templates"); const design=await createDesignFromTemplate(user.id,template.id); if(!design) redirect("/templates"); redirect(`/editor/${design.id}`); }
