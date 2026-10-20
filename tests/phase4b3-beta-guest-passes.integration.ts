import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createOrganization } from "@/services/organizations";
import { grantBetaAccess } from "@/services/beta";
import { issueBetaGuestPasses, issueGuestPasses, replaceGuestPassToken, revokeGuestPass } from "@/services/guest-passes-qr";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 4B.3 beta guest-pass PostgreSQL integration", () => {
  it.skipIf(!enabled)("issues personal and organization beta passes safely", async () => {
    const db = getDb(); const suffix = randomUUID();
    let userId = "", otherUserId = "", orgId = "", otherOrgId = "", eventId = "", designId = "";
    const grantIds: string[] = []; const purchaseIds: string[] = []; const passIds: string[] = [];
    try {
      const user = await db.user.create({ data: { name: "Beta Pass Owner", email: `bp-${suffix}@example.com`, passwordHash: "test" } }); userId = user.id;
      const other = await db.user.create({ data: { name: "Beta Pass Other", email: `bp-other-${suffix}@example.com`, passwordHash: "test" } }); otherUserId = other.id;
      const org = await createOrganization(userId, `Beta Pass Org ${suffix}`); orgId = org.id;
      const otherOrg = await createOrganization(otherUserId, `Beta Other Org ${suffix}`); otherOrgId = otherOrg.id;
      const design = await db.design.create({ data: { userId, name: "Beta pass design", width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1, elements: [] } } }); designId = design.id;
      const event = await db.event.create({ data: { userId, designId, title: "Beta pass event", slug: `beta-pass-${suffix}`, eventType: "WEDDING", eventDate: new Date(Date.now()+86400000) } }); eventId = event.id;
      await db.betaConfiguration.upsert({ where: { id: "default" }, update: { enabled: true }, create: { id: "default", enabled: true } });
      const personal = await grantBetaAccess(true, userId, null, new Date(Date.now()+3600000), { designLimit: 1, eventLimit: 1, guestPassLimit: 3 }); expect(personal).not.toBeNull(); if (personal) grantIds.push(personal.id);
      const orgGrant = await grantBetaAccess(true, null, orgId, new Date(Date.now()+3600000), { designLimit: 1, eventLimit: 1, guestPassLimit: 4 }); expect(orgGrant).not.toBeNull(); if (orgGrant) grantIds.push(orgGrant.id);
      const first = await issueBetaGuestPasses(userId, eventId, 2, `beta-${suffix}`); expect(first?.passes).toHaveLength(2); if (first) { purchaseIds.push(first.purchaseId); const issued = await db.guestPass.findMany({ where: { purchaseId: first.purchaseId }, select: { id: true } }); passIds.push(...issued.map(p => p.id)); }
      const retry = await issueBetaGuestPasses(userId, eventId, 2, `beta-${suffix}`); expect(retry?.idempotent).toBe(true); expect(retry?.passes).toHaveLength(0);
      const exhausted = await issueBetaGuestPasses(userId, eventId, 2, `beta-more-${suffix}`); expect(exhausted).toBeNull();
      const wrongOrg = await issueBetaGuestPasses(otherUserId, eventId, 1, `wrong-${suffix}`); expect(wrongOrg).toBeNull();
      const replacement = await replaceGuestPassToken(userId, passIds[0], 0); expect(replacement?.token).toBeTruthy();
      const revoked = await revokeGuestPass(userId, passIds[1]); expect(revoked.count).toBe(1);
      const passCount = await db.guestPass.count({ where: { eventId } }); expect(passCount).toBe(2);
      expect(await db.payment.count({ where: { order: { eventId } } })).toBe(0);
      expect(await db.organizationSubscription.count({ where: { organizationId: orgId } })).toBe(0);
      const concurrent = await Promise.all([issueBetaGuestPasses(userId, eventId, 1, `c1-${suffix}`), issueBetaGuestPasses(userId, eventId, 1, `c2-${suffix}`)]); expect(concurrent.filter(Boolean).length).toBeLessThanOrEqual(1);
      const sameKey = await Promise.all([issueBetaGuestPasses(userId, eventId, 1, `same-${suffix}`), issueBetaGuestPasses(userId, eventId, 1, `same-${suffix}`)]);
      expect(sameKey.filter(Boolean).length).toBeLessThanOrEqual(1);
      const grantAfter = await db.betaGrant.findUnique({ where: { id: personal!.id }, select: { guestPassesUsed: true, guestPassLimit: true } });
      expect(grantAfter!.guestPassesUsed).toBeLessThanOrEqual(grantAfter!.guestPassLimit);
    } finally {
      // Respect FK order: check-ins -> passes -> purchases -> event -> design/grants/tenants.
      // Query only this fixture event so no pre-existing records can be removed.
      try {
        if (eventId) {
          const fixturePurchases = await db.guestPassPurchase.findMany({ where: { eventId }, select: { id: true } });
          const fixturePurchaseIds = fixturePurchases.map((purchase) => purchase.id);
          if (passIds.length) await db.checkIn.deleteMany({ where: { passId: { in: passIds } } });
          await db.checkIn.deleteMany({ where: { eventId } });
          await db.guestPass.deleteMany({ where: { eventId } });
          if (fixturePurchaseIds.length) await db.guestPassPurchase.deleteMany({ where: { id: { in: fixturePurchaseIds } } });
          await db.event.deleteMany({ where: { id: eventId } });
        }
        if (designId) await db.design.deleteMany({ where: { id: designId } });
        if (grantIds.length) await db.betaGrant.deleteMany({ where: { id: { in: grantIds } } });
        for (const id of [orgId, otherOrgId]) if (id) {
          await db.organizationMember.deleteMany({ where: { organizationId: id } });
          await db.organization.deleteMany({ where: { id } });
        }
        for (const id of [userId, otherUserId]) if (id) await db.user.deleteMany({ where: { id } });
      } catch (cleanupError) {
        // Never replace the original assertion/issuance error with cleanup noise.
        console.error("Phase 4B.3 fixture cleanup failed", cleanupError);
      }
    }
  });
});
