"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createBlankDesign } from "@/services/designs";
export async function startFromScratch(formData: FormData) { const user = await requireUser("/create"); const format = String(formData.get("format") || "portrait") as "portrait" | "landscape" | "square"; const design = await createBlankDesign(user.id, ["portrait", "landscape", "square"].includes(format) ? format : "portrait"); redirect(`/editor/${design.id}`); }
