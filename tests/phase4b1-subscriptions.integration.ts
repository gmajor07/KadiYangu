import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createOrganization } from "@/services/organizations";
import { activateSubscriptionFromTrustedVerification, createPendingBillingRecord, getOrganizationSubscription, listActiveSubscriptionPlans } from "@/services/subscriptions";
const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 4B.1 subscription and billing PostgreSQL integration", () => {
  it.skipIf(!enabled)("enforces plans, billing roles, idempotency and trusted activation", async () => {
    const db = getDb(); const suffix = randomUUID(); let ownerId = "", billingId = "", adminId = "", orgId = "", otherOrgId = "", planId = ""; const recordIds: string[] = [];
    try {
      const owner = await db.user.create({ data: { name: "Billing Owner", email: `billing-owner-${suffix}@example.com`, passwordHash: "test" } }); ownerId = owner.id;
      const billing = await db.user.create({ data: { name: "Billing User", email: `billing-user-${suffix}@example.com`, passwordHash: "test" } }); billingId = billing.id;
      const admin = await db.user.create({ data: { name: "Billing Admin", email: `billing-admin-${suffix}@example.com`, passwordHash: "test" } }); adminId = admin.id;
      orgId = (await createOrganization(ownerId, `Billing Org ${suffix}`)).id; otherOrgId = (await createOrganization(adminId, `Other Billing Org ${suffix}`)).id;
      await db.organizationMember.create({ data: { organizationId: orgId, userId: billingId, role: "BILLING", status: "ACTIVE" } });
      await db.organizationMember.create({ data: { organizationId: orgId, userId: adminId, role: "ADMIN", status: "ACTIVE" } });
      const plan = await db.subscriptionPlan.create({ data: { code: "STARTER", name: `Starter ${suffix}`, monthlyAmount: 1000, annualAmount: 10000, eventLimit: 5, designLimit: 10, memberLimit: 3, guestPassLimit: 100 } }); planId = plan.id;
      expect((await listActiveSubscriptionPlans()).some((p) => p.id === plan.id)).toBe(true);
      const first = await createPendingBillingRecord(ownerId, orgId, "STARTER", "MONTHLY", `key-${suffix}`); expect(first?.amount).toBe(1000); expect(first?.status).toBe("PENDING"); if (first) recordIds.push(first.id);
      expect(await createPendingBillingRecord(adminId, orgId, "STARTER", "MONTHLY", `admin-${suffix}`)).toBeNull();
      const same = await createPendingBillingRecord(billingId, orgId, "STARTER", "MONTHLY", `key-${suffix}`); expect(same?.id).toBe(first?.id);
      expect(await createPendingBillingRecord(billingId, otherOrgId, "STARTER", "MONTHLY", `key-${suffix}`)).toBeNull();
      expect((await activateSubscriptionFromTrustedVerification(first!.id, false)).ok).toBe(false);
      const activations = await Promise.all([activateSubscriptionFromTrustedVerification(first!.id, true), activateSubscriptionFromTrustedVerification(first!.id, true)]);
      expect(activations.filter((x) => x.ok)).toHaveLength(1);
      expect(await db.organizationSubscription.count({ where: { organizationId: orgId } })).toBe(1);
      expect((await getOrganizationSubscription(adminId, orgId))?.organizationId).toBe(orgId);
      expect(await getOrganizationSubscription(adminId, otherOrgId)).toBeNull();
      await expect(db.organization.delete({ where: { id: orgId } })).rejects.toBeTruthy();
    } finally {
      if (recordIds.length) await db.organizationBillingRecord.deleteMany({ where: { id: { in: recordIds } } });
      if (orgId) { await db.organizationSubscription.deleteMany({ where: { organizationId: orgId } }); await db.organizationMember.deleteMany({ where: { organizationId: orgId } }); await db.organization.deleteMany({ where: { id: orgId } }); }
      if (otherOrgId) { await db.organizationMember.deleteMany({ where: { organizationId: otherOrgId } }); await db.organization.deleteMany({ where: { id: otherOrgId } }); }
      if (planId) await db.subscriptionPlan.deleteMany({ where: { id: planId } });
      for (const id of [ownerId, billingId, adminId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });

  it.skipIf(!enabled)("preserves billing snapshots across plan edits and rejects inactive plans", async () => {
    const db = getDb(); const suffix = randomUUID(); let userId = "", orgId = "", planId = "", recordId = "";
    try {
      const user = await db.user.create({ data: { name: "Plan Admin Fixture", email: `plan-admin-${suffix}@example.com`, passwordHash: "test" } }); userId = user.id;
      orgId = (await createOrganization(userId, `Plan Org ${suffix}`)).id;
      const plan = await db.subscriptionPlan.create({ data: { code: "BUSINESS", name: `Business ${suffix}`, monthlyAmount: 2500, annualAmount: 25000, eventLimit: 20, designLimit: 40, memberLimit: 10, guestPassLimit: 500 } }); planId = plan.id;
      const request = await createPendingBillingRecord(userId, orgId, "BUSINESS", "MONTHLY", `snapshot-${suffix}`); expect(request?.amount).toBe(2500); if (!request) return; recordId = request.id;
      await db.subscriptionPlan.update({ where: { id: planId }, data: { monthlyAmount: 4000, eventLimit: 99 } });
      const snapshot = await db.organizationBillingRecord.findUniqueOrThrow({ where: { id: recordId } });
      expect(snapshot.amount).toBe(2500); expect(snapshot.planNameSnapshot).toBe(`Business ${suffix}`);
      await db.subscriptionPlan.update({ where: { id: planId }, data: { isActive: false } });
      expect(await createPendingBillingRecord(userId, orgId, "BUSINESS", "MONTHLY", `inactive-${suffix}`)).toBeNull();
    } finally {
      if (recordId) await db.organizationBillingRecord.deleteMany({ where: { id: recordId } });
      if (orgId) { await db.organizationMember.deleteMany({ where: { organizationId: orgId } }); await db.organization.deleteMany({ where: { id: orgId } }); }
      if (planId) await db.subscriptionPlan.deleteMany({ where: { id: planId } });
      if (userId) await db.user.deleteMany({ where: { id: userId } });
    }
  });
});
