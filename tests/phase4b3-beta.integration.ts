import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createOrganization } from "@/services/organizations";
import { grantBetaAccess, hasBetaAccess, submitFeedback } from "@/services/beta";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 4B.3 beta and feedback PostgreSQL integration", () => {
  it.skipIf(!enabled)("enforces beta ownership, expiry, quotas, isolation and feedback limits", async () => {
    const db = getDb();
    const suffix = randomUUID();
    let userId = "", otherUserId = "", orgId = "", otherOrgId = "";
    const grantIds: string[] = [];
    const feedbackIds: string[] = [];
    try {
      const user = await db.user.create({ data: { name: "Beta Fixture User", email: `beta-${suffix}@example.com`, passwordHash: "test" } }); userId = user.id;
      const other = await db.user.create({ data: { name: "Beta Other User", email: `beta-other-${suffix}@example.com`, passwordHash: "test" } }); otherUserId = other.id;
      orgId = (await createOrganization(userId, `Beta Org ${suffix}`)).id;
      otherOrgId = (await createOrganization(otherUserId, `Beta Other Org ${suffix}`)).id;
      await db.betaConfiguration.upsert({ where: { id: "default" }, update: { enabled: true }, create: { id: "default", enabled: true } });

      const personalGrant = await grantBetaAccess(true, userId, null, new Date(Date.now() + 3_600_000), { designLimit: 2, eventLimit: 1, guestPassLimit: 5 });
      expect(personalGrant?.userId).toBe(userId);
      if (personalGrant) grantIds.push(personalGrant.id);
      const orgGrant = await grantBetaAccess(true, null, orgId, new Date(Date.now() + 3_600_000), { designLimit: 10, eventLimit: 3, guestPassLimit: 20 });
      expect(orgGrant?.organizationId).toBe(orgId);
      if (orgGrant) grantIds.push(orgGrant.id);
      expect(await hasBetaAccess(userId)).toBe(true);
      expect(await hasBetaAccess(userId, orgId)).toBe(true);
      expect(await hasBetaAccess(otherUserId, orgId)).toBe(false);
      expect(await hasBetaAccess(userId, otherOrgId)).toBe(false);
      await db.betaGrant.update({ where: { id: personalGrant!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await hasBetaAccess(userId)).toBe(false);

      await expect(db.betaGrant.create({ data: { userId, organizationId: orgId, expiresAt: new Date(Date.now() + 1000) } })).rejects.toBeTruthy();
      await expect(db.betaGrant.create({ data: { expiresAt: new Date(Date.now() + 1000) } })).rejects.toBeTruthy();
      await expect(db.betaGrant.create({ data: { userId: otherUserId, grantType: `BAD-${suffix}`, expiresAt: new Date(Date.now() + 1000), designLimit: -1 } })).rejects.toBeTruthy();
      await expect(db.feedback.create({ data: { userId, rating: 6, message: "invalid rating" } })).rejects.toBeTruthy();
      await expect(db.feedback.create({ data: { userId, rating: 5, status: "INVALID", message: "invalid status" } })).rejects.toBeTruthy();

      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => submitFeedback(userId, null, 5, `Concurrent feedback ${i} ${suffix}`, false)));
      const accepted = results.filter(Boolean); expect(accepted.length).toBeLessThanOrEqual(3); feedbackIds.push(...accepted.map((item) => item!.id));
      const independent = await submitFeedback(otherUserId, null, 4, `Independent feedback ${suffix}`, false);
      expect(independent).not.toBeNull(); if (independent) feedbackIds.push(independent.id);
      expect(await db.organizationSubscription.count({ where: { organizationId: orgId } })).toBe(0);
      expect(await db.payment.count({ where: { metadata: { path: ["betaFixture"], equals: suffix } } })).toBe(0);
    } finally {
      if (feedbackIds.length) await db.feedback.deleteMany({ where: { id: { in: feedbackIds } } });
      if (grantIds.length) await db.betaGrant.deleteMany({ where: { id: { in: grantIds } } });
      if (orgId) { await db.organizationMember.deleteMany({ where: { organizationId: orgId } }); await db.organization.deleteMany({ where: { id: orgId } }); }
      if (otherOrgId) { await db.organizationMember.deleteMany({ where: { organizationId: otherOrgId } }); await db.organization.deleteMany({ where: { id: otherOrgId } }); }
      for (const id of [userId, otherUserId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });
});
