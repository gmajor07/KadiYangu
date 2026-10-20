"use server";
import { revalidatePath } from "next/cache";import { requireAdmin } from "@/lib/auth/guards";import { setCustomerStatus } from "@/services/admin-customers";
export async function updateCustomerStatus(formData:FormData){await requireAdmin();const id=String(formData.get("id"));const status=String(formData.get("status"));if(id&&["ACTIVE","SUSPENDED"].includes(status))await setCustomerStatus(id,status as "ACTIVE"|"SUSPENDED");revalidatePath("/admin/customers");}
