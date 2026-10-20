import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { registerUser } from "@/services/registration";
import { claimPersonalBeta, getBetaSummary } from "@/services/beta";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 4B.4A beta onboarding PostgreSQL integration", () => {
  it.skipIf(!enabled)("auto-grants new users and safely claims existing access", async () => {
    const db = getDb(); const suffix = randomUUID();
    let userId = "", existingId = ""; const grantIds: string[] = [];
    const previous = await db.betaConfiguration.findUnique({ where: { id: "default" } });
    try {
      await db.betaConfiguration.upsert({ where: { id: "default" }, update: { enabled: true, personalExpiresAt: new Date(Date.now() + 3600000), personalDesignLimit: 2, personalEventLimit: 1, personalGuestPassLimit: 4 }, create: { id: "default", enabled: true, personalExpiresAt: new Date(Date.now() + 3600000), personalDesignLimit: 2, personalEventLimit: 1, personalGuestPassLimit: 4 } });
      const email = `onboard-${suffix}@example.com`;
      const registration = await registerUser({ name: "Beta Onboard", email, password: "LongEnoughPassword123!" });
      expect(registration.ok).toBe(true);
      const user = await db.user.findUnique({ where: { email }, select: { id: true } }); expect(user).not.toBeNull(); userId = user!.id;
      const autoGrant = await db.betaGrant.findUnique({ where: { userId_grantType: { userId, grantType: "BETA_GRANT" } } }); expect(autoGrant?.designLimit).toBe(2); if (autoGrant) grantIds.push(autoGrant.id);
      const existing = await db.user.create({ data: { name: "Existing Beta", email: `existing-${suffix}@example.com`, passwordHash: "test" } }); existingId = existing.id;
      const claims = await Promise.all([claimPersonalBeta(existingId), claimPersonalBeta(existingId), claimPersonalBeta(existingId)]);
      expect(claims.filter(Boolean).length).toBe(3);
      const grants = await db.betaGrant.findMany({ where: { userId: existingId, grantType: "BETA_GRANT" } }); expect(grants).toHaveLength(1); grantIds.push(grants[0].id);
      expect(await getBetaSummary(userId)).not.toBeNull();
      await db.betaConfiguration.update({ where: { id: "default" }, data: { enabled: false } });
      const disabled = await db.user.create({ data: { name: "Disabled Beta", email: `disabled-${suffix}@example.com`, passwordHash: "test" } });
      expect(await claimPersonalBeta(disabled.id)).toBeNull(); await db.user.delete({ where: { id: disabled.id } });
      expect(await getBetaSummary(userId)).toBeNull();
    } finally {
      if (previous) await db.betaConfiguration.update({ where: { id: "default" }, data: { enabled: previous.enabled, personalExpiresAt: previous.personalExpiresAt, organizationExpiresAt: previous.organizationExpiresAt, personalDesignLimit: previous.personalDesignLimit, personalEventLimit: previous.personalEventLimit, personalGuestPassLimit: previous.personalGuestPassLimit, organizationDesignLimit: previous.organizationDesignLimit, organizationEventLimit: previous.organizationEventLimit, organizationGuestPassLimit: previous.organizationGuestPassLimit } });
      if (grantIds.length) await db.betaGrant.deleteMany({ where: { id: { in: grantIds } } });
      for (const id of [userId, existingId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });
});
