"use server";
import { requireUser } from "@/lib/auth/guards"; import { submitFeedback } from "@/services/beta"; import { redirect } from "next/navigation";
export async function sendFeedback(form: FormData){ const user=await requireUser("/dashboard/feedback"); const result=await submitFeedback(user.id,String(form.get("organizationId")||"")||null,Number(form.get("rating")),String(form.get("message")||""),form.get("contactAllowed")==="on"); redirect(result?"/dashboard/feedback?sent=1":"/dashboard/feedback?error=limit"); }
