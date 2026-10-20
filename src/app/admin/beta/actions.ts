"use server";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { grantBetaAccess } from "@/services/beta";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
const int = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : null; };
export async function saveBetaConfiguration(form: FormData) {
  await requireAdmin();
  const values = ["personalDesignLimit","personalEventLimit","personalGuestPassLimit","organizationDesignLimit","organizationEventLimit","organizationGuestPassLimit"].map(k => int(form.get(k)));
  if (values.some(v => v === null)) redirect("/admin/beta?error=invalid");
  const [personalDesignLimit,personalEventLimit,personalGuestPassLimit,organizationDesignLimit,organizationEventLimit,organizationGuestPassLimit] = values as number[];
  const db = getDb();
  await db.betaConfiguration.upsert({ where:{id:"default"}, update:{enabled:form.get("enabled")==="on",personalExpiresAt:form.get("personalExpiresAt")?new Date(String(form.get("personalExpiresAt"))):null,organizationExpiresAt:form.get("organizationExpiresAt")?new Date(String(form.get("organizationExpiresAt"))):null,personalDesignLimit,personalEventLimit,personalGuestPassLimit,organizationDesignLimit,organizationEventLimit,organizationGuestPassLimit}, create:{id:"default",enabled:form.get("enabled")==="on",personalExpiresAt:null,organizationExpiresAt:null,personalDesignLimit,personalEventLimit,personalGuestPassLimit,organizationDesignLimit,organizationEventLimit,organizationGuestPassLimit} });
  revalidatePath("/admin/beta"); redirect("/admin/beta?saved=1");
}
export async function issueBetaGrant(form: FormData) {
  await requireAdmin();
  const userId = String(form.get("userId")||"").trim() || null; const organizationId = String(form.get("organizationId")||"").trim() || null;
  const expiresAt = new Date(String(form.get("expiresAt")||"")); const limits = { designLimit:int(form.get("designLimit")), eventLimit:int(form.get("eventLimit")), guestPassLimit:int(form.get("guestPassLimit")) };
  if (limits.designLimit===null||limits.eventLimit===null||limits.guestPassLimit===null||Number.isNaN(expiresAt.getTime())) redirect("/admin/beta?error=invalid");
  const grant = await grantBetaAccess(true,userId,organizationId,expiresAt,limits as {designLimit:number;eventLimit:number;guestPassLimit:number});
  if (!grant) redirect("/admin/beta?error=invalid"); revalidatePath("/admin/beta"); redirect("/admin/beta?saved=1");
}
