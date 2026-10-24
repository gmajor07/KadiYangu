import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { contributionReport, contributionSummary } from "@/services/contributions";

const enabled = process.env.ALLOW_PHASE7E1_DB_TESTS === "true";
function safeReportingDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  const url = new URL(raw);
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    && url.pathname === "/kadiyangu_phase7e1_test"
    && !/railway/i.test(url.hostname);
}

describe("Phase 7E.2 contribution reporting PostgreSQL integration", () => {
  it.skipIf(!enabled || !safeReportingDatabase())("reports authorized event data with filters and accounting rules", async () => {
    const db = getDb(); const suffix = randomUUID();
    let userId = "", otherUserId = "", designId = "", eventId = "", otherEventId = "", contributorId = "";
    const paymentIds: string[] = [], pledgeIds: string[] = [], auditIds: string[] = [];
    try {
      const user = await db.user.create({ data: { name: "Reporting Owner", email: `report-owner-${suffix}@example.com`, passwordHash: "test" } }); userId = user.id;
      const other = await db.user.create({ data: { name: "Reporting Other", email: `report-other-${suffix}@example.com`, passwordHash: "test" } }); otherUserId = other.id;
      const design = await db.design.create({ data: { userId, name: `Reporting Design ${suffix}`, width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1 }, status: "DRAFT" } }); designId = design.id;
      const event = await db.event.create({ data: { userId, designId, title: `Reporting Event ${suffix}`, slug: `reporting-${suffix}`, eventType: "Other", eventDate: new Date("2035-01-01") } }); eventId = event.id;
      const otherDesign = await db.design.create({ data: { userId: otherUserId, name: `Other Design ${suffix}`, width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1 }, status: "DRAFT" } });
      const otherEvent = await db.event.create({ data: { userId: otherUserId, designId: otherDesign.id, title: `Other Event ${suffix}`, slug: `other-reporting-${suffix}`, eventType: "Other", eventDate: new Date("2035-01-02") } }); otherEventId = otherEvent.id;
      const contributor = await db.eventContributor.create({ data: { eventId, fullName: "Alice Alpha", phone: "0711000001" } }); contributorId = contributor.id;
      const second = await db.eventContributor.create({ data: { eventId, fullName: "Bob Beta", phone: "0711000002" } });
      const pledge = await db.contributionPledge.create({ data: { contributorId, amount: 100000 } }); pledgeIds.push(pledge.id);
      const pledge2 = await db.contributionPledge.create({ data: { contributorId: second.id, amount: 50000 } }); pledgeIds.push(pledge2.id);
      const confirmed = await db.contributionPayment.create({ data: { contributorId, pledgeId: pledge.id, amount: 60000, method: "MPESA", verificationStatus: "CONFIRMED", paymentDate: new Date("2026-01-05"), recordedByUserId: userId, referenceNumber: `confirmed-${suffix}` } }); paymentIds.push(confirmed.id);
      const pending = await db.contributionPayment.create({ data: { contributorId, amount: 10000, method: "CASH", verificationStatus: "PENDING", paymentDate: new Date("2026-01-06"), recordedByUserId: userId, referenceNumber: `pending-${suffix}` } }); paymentIds.push(pending.id);
      const reversed = await db.contributionPayment.create({ data: { contributorId: second.id, amount: 50000, method: "MPESA", verificationStatus: "REVERSED", paymentDate: new Date("2026-01-07"), recordedByUserId: userId, referenceNumber: `reversed-${suffix}` } }); paymentIds.push(reversed.id);
      const audit = await db.auditLog.create({ data: { actorUserId: userId, action: "REPORT_FIXTURE", entityType: "Contribution", entityId: contributorId } }); auditIds.push(audit.id);

      const report = await contributionReport(userId, eventId, { page: 1, pageSize: 10 });
      expect(report?.total).toBe(2);
      expect(report?.rows.find(row => row.id === contributorId)).toMatchObject({ pledged: 100000, paid: 60000, outstanding: 40000, status: "PARTIAL" });
      expect(report?.rows.find(row => row.fullName === "Bob Beta")).toMatchObject({ pledged: 50000, paid: 0, outstanding: 50000, status: "UNPAID" });
      expect((await contributionSummary(userId, eventId))?.totalConfirmed).toBe(60000);

      expect((await contributionReport(userId, eventId, { query: "0711000001" }))?.rows).toHaveLength(1);
      expect((await contributionReport(userId, eventId, { status: "UNPAID" }))?.rows.map(row => row.fullName)).toEqual(["Bob Beta"]);
      expect((await contributionReport(userId, eventId, { method: "MPESA" }))?.rows).toHaveLength(2);
      // Date filters apply to payment activity. Contributors and lifetime
      // pledges remain visible so the report can show period collection while
      // keeping lifetime outstanding balances meaningful.
      const period = await contributionReport(userId, eventId, { from: new Date("2026-01-06"), to: new Date("2026-01-06T23:59:59.999Z") });
      expect(period?.rows).toHaveLength(2);
      expect(period?.rows.find(row => row.id === contributorId)).toMatchObject({ pledged: 100000, paid: 0, outstanding: 100000 });
      expect(period?.rows.find(row => row.fullName === "Bob Beta")).toMatchObject({ pledged: 50000, paid: 0 });
      const emptyPeriod = await contributionReport(userId, eventId, { from: new Date("2027-01-01"), to: new Date("2027-01-02T23:59:59.999Z") });
      expect(emptyPeriod?.rows).toHaveLength(2);
      expect(emptyPeriod?.rows.every(row => row.paid === 0)).toBe(true);
      expect((await contributionReport(userId, eventId, { sort: "pledged" }))?.rows[0].fullName).toBe("Alice Alpha");
      expect((await contributionReport(userId, eventId, { page: 2, pageSize: 1 }))?.rows).toHaveLength(1);
      expect(await contributionReport(otherUserId, eventId)).toBeNull();
      expect(await contributionReport(userId, otherEventId)).toBeNull();
      expect(await contributionReport(userId, eventId, { query: "does-not-exist" })).toMatchObject({ total: 0, rows: [] });
    } finally {
      if (auditIds.length) await db.auditLog.deleteMany({ where: { id: { in: auditIds } } });
      if (paymentIds.length) await db.contributionPayment.deleteMany({ where: { id: { in: paymentIds } } });
      if (pledgeIds.length) await db.contributionPledge.deleteMany({ where: { id: { in: pledgeIds } } });
      if (eventId) await db.eventContributor.deleteMany({ where: { eventId } });
      if (eventId) await db.event.deleteMany({ where: { id: eventId } });
      if (otherEventId) { const other = await db.event.findUnique({ where: { id: otherEventId }, select: { designId: true } }); await db.event.deleteMany({ where: { id: otherEventId } }); if (other) await db.design.deleteMany({ where: { id: other.designId } }); }
      if (designId) await db.design.deleteMany({ where: { id: designId } });
      for (const id of [userId, otherUserId]) if (id) await db.user.deleteMany({ where: { id } });
    }
  });
});
