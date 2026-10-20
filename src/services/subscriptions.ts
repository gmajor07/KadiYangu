import "server-only";
import { getDb } from "@/lib/db";
import { requireOrganizationMember } from "@/services/organizations";
import type { BillingInterval, OrganizationBillingStatus, OrganizationSubscriptionStatus, SubscriptionPlanCode } from "@prisma/client";

export const BILLING_ROLES = ["OWNER", "BILLING"] as const;
export const VIEW_ROLES = ["OWNER", "ADMIN", "MANAGER", "BILLING"] as const;

export function listActiveSubscriptionPlans() {
  return getDb().subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
}

export async function getOrganizationSubscription(userId: string, organizationId: string) {
  if (!await requireOrganizationMember(userId, organizationId, [...VIEW_ROLES])) return null;
  return getDb().organizationSubscription.findFirst({ where: { organizationId }, include: { plan: true }, orderBy: { createdAt: "desc" } });
}

export async function createPendingBillingRecord(userId: string, organizationId: string, planCode: SubscriptionPlanCode, interval: BillingInterval, idempotencyKey: string) {
  if (!await requireOrganizationMember(userId, organizationId, [...BILLING_ROLES])) return null;
  if (!idempotencyKey || idempotencyKey.length > 120) return null;
  const plan = await getDb().subscriptionPlan.findFirst({ where: { code: planCode, isActive: true } });
  if (!plan) return null;
  const amount = interval === "MONTHLY" ? plan.monthlyAmount : plan.annualAmount;
  const db = getDb();
  const existing = await db.organizationBillingRecord.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.organizationId !== organizationId || existing.planId !== plan.id || existing.interval !== interval || existing.amount !== amount || existing.currency !== plan.currency) return null;
    return existing;
  }
  return db.organizationBillingRecord.create({ data: { organizationId, planId: plan.id, initiatedByUserId: userId, idempotencyKey, status: "PENDING", planNameSnapshot: plan.name, interval, amount, currency: plan.currency } });
}

/** Deliberately server-internal: browser redirects and demo payments cannot call this. */
export async function activateSubscriptionFromTrustedVerification(billingRecordId: string, trustedVerification: boolean) {
  if (!trustedVerification) return { ok: false as const, reason: "TRUSTED_VERIFICATION_REQUIRED" };
  const db = getDb();
  return db.$transaction(async (tx) => {
    const record = await tx.organizationBillingRecord.findUnique({ where: { id: billingRecordId } });
    if (!record || record.status !== "PENDING") return { ok: false as const, reason: "NOT_PENDING" };
    const claimed = await tx.organizationBillingRecord.updateMany({ where: { id: record.id, status: "PENDING" }, data: { status: "VERIFIED", verifiedAt: new Date() } });
    if (claimed.count !== 1) return { ok: false as const, reason: "ALREADY_PROCESSED" };
    const subscription = await tx.organizationSubscription.create({ data: { organizationId: record.organizationId, planId: record.planId, status: "ACTIVE", interval: record.interval, planNameSnapshot: record.planNameSnapshot, amountSnapshot: record.amount, currencySnapshot: record.currency, periodStart: new Date(), periodEnd: new Date(Date.now() + (record.interval === "MONTHLY" ? 30 : 365) * 86400000) } });
    await tx.organizationBillingRecord.update({ where: { id: record.id }, data: { subscriptionId: subscription.id } });
    return { ok: true as const, subscriptionId: subscription.id };
  });
}

export type SubscriptionLifecycle = OrganizationSubscriptionStatus | OrganizationBillingStatus;
