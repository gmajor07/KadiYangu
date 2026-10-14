"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { startDemoPayment, verifyDemoPayment } from "@/services/commerce";
export async function startPaymentAction(formData:FormData){const user=await requireUser(); const orderId=String(formData.get("orderId")); const result=await startDemoPayment(user.id,orderId,String(formData.get("provider")||"MPESA"),String(formData.get("phone")||"")); if(!result.ok) throw new Error(result.error); redirect(`/checkout/${orderId}?payment=${result.paymentId}`);}
export async function verifyPaymentAction(formData:FormData){const user=await requireUser(); const orderId=String(formData.get("orderId")); const result=await verifyDemoPayment(user.id,String(formData.get("paymentId")),String(formData.get("reference")||"")); redirect(`/checkout/${orderId}?payment=${String(formData.get("paymentId"))}&verified=${result.ok ? "1" : "0"}`);}
