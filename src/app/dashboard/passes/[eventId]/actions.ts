"use server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/guards";
import { issueGuestPasses, issueBetaGuestPasses, revokeGuestPass, assignGuestPass } from "@/services/guest-passes-qr";
import { revalidatePath } from "next/cache";
export async function issuePass(formData: FormData) { const u=await requireUser(); const eventId=String(formData.get("eventId")); const purchaseId=String(formData.get("purchaseId")); const quantity=Math.max(1,Number(formData.get("quantity"))); await issueGuestPasses(u.id,eventId,quantity,purchaseId); revalidatePath(`/dashboard/passes/${eventId}`); }
export async function issueBetaPass(formData: FormData) { const u=await requireUser(); const eventId=String(formData.get("eventId")); const quantity=Math.max(1,Number(formData.get("quantity"))); const key=String(formData.get("idempotencyKey")||randomUUID()); await issueBetaGuestPasses(u.id,eventId,quantity,key); revalidatePath(`/dashboard/passes/${eventId}`); }
export async function revokePass(formData: FormData) { const u=await requireUser(); const eventId=String(formData.get("eventId")); await revokeGuestPass(u.id,String(formData.get("passId"))); revalidatePath(`/dashboard/passes/${eventId}`); }
export async function assignPass(formData: FormData) { const u=await requireUser(); const eventId=String(formData.get("eventId")); await assignGuestPass(u.id,String(formData.get("passId")),String(formData.get("guestId"))); revalidatePath(`/dashboard/passes/${eventId}`); }
