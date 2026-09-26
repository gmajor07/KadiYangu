"use server";
import { requireUser } from "@/lib/auth/guards";
import { completeTestPayment } from "@/services/commerce";
export async function simulatePaymentAction(formData: FormData) { const user = await requireUser(); await completeTestPayment(user.id, String(formData.get("orderId")), String(formData.get("outcome"))); }
