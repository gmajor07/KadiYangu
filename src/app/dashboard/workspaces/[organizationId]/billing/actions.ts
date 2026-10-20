"use server";
import { requireUser } from "@/lib/auth/guards";
import { createPendingBillingRecord } from "@/services/subscriptions";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
export async function requestSubscription(form: FormData) { const user = await requireUser(); const organizationId = String(form.get("organizationId")); const planCode = String(form.get("planCode")) as "STARTER" | "BUSINESS" | "ENTERPRISE"; const interval = String(form.get("interval")) as "MONTHLY" | "ANNUAL"; await createPendingBillingRecord(user.id, organizationId, planCode, interval, randomUUID()); redirect(`/dashboard/workspaces/${organizationId}/billing?requested=1`); }
