import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createContributor, createPledge, recordContributionPayment, contributionSummary, reverseContributionPayment, updateContributor } from "@/services/contributions";

const enabled = process.env.ALLOW_PHASE7E1_DB_TESTS === "true";
function safeTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  const url = new URL(raw);
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname) && !/railway/i.test(url.pathname) && !/railway/i.test(url.hostname);
}

describe("Phase 7E.1 contributions PostgreSQL integration", () => {
  it.skipIf(!enabled || !safeTarget())("covers authorization, accounting, correction and audit behavior", async () => {
    const db = getDb(); const suffix = randomUUID();
    let userId = "", otherId = "", eventId = "", designId = "", guestId = "", contributorId = "";
    const pledgeIds: string[] = [], paymentIds: string[] = [], auditIds: string[] = [];
    try {
      const user = await db.user.create({ data: { name: "Contribution Owner", email: `contrib-${suffix}@example.com`, passwordHash: "test" } }); userId = user.id;
      const other = await db.user.create({ data: { name: "Other Owner", email: `contrib-other-${suffix}@example.com`, passwordHash: "test" } }); otherId = other.id;
      const design = await db.design.create({ data: { userId, name: `Contribution Design ${suffix}`, width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1 }, status: "DRAFT" } }); designId = design.id;
      const event = await db.event.create({ data: { userId, designId, title: `Contribution Event ${suffix}`, slug: `contrib-${suffix}`, eventType: "Other", eventDate: new Date("2035-01-01") } }); eventId = event.id;
      const guest = await db.guest.create({ data: { eventId, name: "Linked Guest", invitationCode: `contrib-${suffix}` } }); guestId = guest.id;

      const contributor = await createContributor(userId, eventId, { fullName: "Linked Guest", guestId });
      expect(contributor?.guestId).toBe(guestId); contributorId = contributor!.id;
      expect(await createContributor(otherId, eventId, { fullName: "Blocked" })).toBeNull();
      expect(await updateContributor(otherId, eventId, contributorId, { fullName: "Blocked" })).toBeNull();

      const first = await createPledge(userId, eventId, contributorId, 100000); const second = await createPledge(userId, eventId, contributorId, 50000);
      expect(first?.amount).toBe(100000); expect(second?.amount).toBe(50000); if (first) pledgeIds.push(first.id); if (second) pledgeIds.push(second.id);
      const pending = await recordContributionPayment(userId, eventId, { contributorId, pledgeId: first?.id, amount: 40000, method: "MPESA", referenceNumber: `ref-a-${suffix}` });
      const confirmed = await recordContributionPayment(userId, eventId, { contributorId, pledgeId: first?.id, amount: 120000, method: "CASH", referenceNumber: `ref-b-${suffix}` });
      expect(pending?.verificationStatus).toBe("PENDING"); expect(confirmed?.verificationStatus).toBe("PENDING"); if (pending) paymentIds.push(pending.id); if (confirmed) paymentIds.push(confirmed.id);
      expect(await recordContributionPayment(userId, eventId, { contributorId, amount: 1, method: "CASH", referenceNumber: `ref-a-${suffix}` })).toBeNull();
      expect(await contributionSummary(userId, eventId)).toMatchObject({ totalPledged: 150000, totalConfirmed: 0, outstanding: 150000 });
      await db.contributionPayment.update({ where: { id: pending!.id }, data: { verificationStatus: "CONFIRMED" } });
      await db.contributionPayment.update({ where: { id: confirmed!.id }, data: { verificationStatus: "CONFIRMED" } });
      expect(await contributionSummary(userId, eventId)).toMatchObject({ totalConfirmed: 160000, outstanding: 0, overpaid: 10000 });
      const reversed = await reverseContributionPayment(userId, eventId, confirmed!.id, "Duplicate manual entry"); expect(reversed?.verificationStatus).toBe("REVERSED");
      expect(await contributionSummary(userId, eventId)).toMatchObject({ totalConfirmed: 40000, outstanding: 110000 });
      const logs = await db.auditLog.findMany({ where: { entityType: "Contribution", entityId: { in: [contributorId, ...pledgeIds, ...paymentIds] } } }); auditIds.push(...logs.map(x => x.id)); expect(logs.length).toBeGreaterThanOrEqual(5);
      const before = await db.eventContributor.count({ where: { eventId } }); await expect(db.$transaction(async tx => { await tx.eventContributor.create({ data: { eventId, fullName: "Rollback" } }); throw new Error("rollback"); })).rejects.toThrow("rollback"); expect(await db.eventContributor.count({ where: { eventId } })).toBe(before);
    } finally {
      if (auditIds.length) await db.auditLog.deleteMany({ where: { id: { in: auditIds } } });
      if (paymentIds.length) await db.contributionPayment.deleteMany({ where: { id: { in: paymentIds } } });
      if (pledgeIds.length) await db.contributionPledge.deleteMany({ where: { id: { in: pledgeIds } } });
      if (contributorId) await db.eventContributor.deleteMany({ where: { id: contributorId } });
      if (guestId) await db.guest.deleteMany({ where: { id: guestId } });
      if (eventId) await db.event.deleteMany({ where: { id: eventId } });
      if (designId) await db.design.deleteMany({ where: { id: designId } });
      for (const id of [userId, otherId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });
});
