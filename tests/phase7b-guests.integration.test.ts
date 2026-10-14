import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { importGuests, previewGuestCsvForEvent } from "@/services/guest-import";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 7B.1 CSV guest import database integration", () => {
  it.skipIf(!enabled)("previews and imports only authorized, non-duplicate rows", async () => {
    const db = getDb();
    const suffix = randomUUID();
    let ownerId = "", otherId = "", designId = "", eventAId = "", eventBId = "";
    const csv = [
      "name,phone,email,category,plusOneAllowed,maxGuests,notes",
      `Valid Guest,0712345699,valid-${suffix}@example.com,VIP,true,3,keeps`,
      `Existing Phone,0712345601,new-phone-${suffix}@example.com,Family,false,2,`,
      `Existing Email,0712345602,existing-${suffix}@example.com,Friends,false,1,`,
      `Repeated Phone,0712345699,repeated-phone-${suffix}@example.com,Other,false,1,`,
      `Repeated Email,0712345603,valid-${suffix}@example.com,Other,false,1,`,
      `Invalid Guest,0712345604,not-an-email,Other,false,0,`,
    ].join("\n");
    try {
      const owner = await db.user.create({ data: { name: "CSV Owner", email: `csv-owner-${suffix}@example.com`, passwordHash: "test", role: "USER", status: "ACTIVE" } });
      ownerId = owner.id;
      const other = await db.user.create({ data: { name: "CSV Other", email: `csv-other-${suffix}@example.com`, passwordHash: "test", role: "USER", status: "ACTIVE" } });
      otherId = other.id;
      const design = await db.design.create({ data: { userId: ownerId, name: `CSV Design ${suffix}`, width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1 }, status: "DRAFT" } });
      designId = design.id;
      const eventA = await db.event.create({ data: { userId: ownerId, designId, title: `CSV Event A ${suffix}`, slug: `csv-a-${suffix}`, eventType: "Other", eventDate: new Date("2030-01-01") } });
      eventAId = eventA.id;
      const eventB = await db.event.create({ data: { userId: ownerId, designId, title: `CSV Event B ${suffix}`, slug: `csv-b-${suffix}`, eventType: "Other", eventDate: new Date("2030-01-02") } });
      eventBId = eventB.id;
      await db.guest.createMany({ data: [
        { eventId: eventAId, name: "A Phone", phone: "255712345601", email: `a-phone-${suffix}@example.com`, invitationCode: `a-phone-${suffix}` },
        { eventId: eventAId, name: "A Email", phone: "255712345602", email: `existing-${suffix}@example.com`, invitationCode: `a-email-${suffix}` },
        { eventId: eventBId, name: "B Contact", phone: "255712345603", email: `b-${suffix}@example.com`, invitationCode: `b-contact-${suffix}` },
      ] });
      const before = await db.guest.count({ where: { eventId: eventAId } });
      const preview = await previewGuestCsvForEvent(ownerId, eventAId, csv);
      expect(preview).toBeTruthy();
      expect(await db.guest.count({ where: { eventId: eventAId } })).toBe(before);
      expect(preview?.duplicates).toBe(4);
      expect(preview?.invalid).toBe(1);
      expect(preview?.rows.filter(r => r.status === "DUPLICATE").map(r => r.reason).join(" ")).toMatch(/phone already/);
      expect(preview?.rows.filter(r => r.status === "DUPLICATE").map(r => r.reason).join(" ")).toMatch(/email already/);
      expect(preview?.rows.filter(r => r.status === "DUPLICATE").map(r => r.reason).join(" ")).toMatch(/appears more than once/);
      const eventBPreview = await previewGuestCsvForEvent(ownerId, eventBId, "name,phone,email\nA Event Contact,0712345601,a-phone@example.com");
      expect(eventBPreview?.duplicates).toBe(0);
      const result = await importGuests(ownerId, eventAId, csv);
      expect(result).toEqual({ imported: 1, skipped: 4, invalid: 1 });
      const imported = await db.guest.findFirstOrThrow({ where: { eventId: eventAId, email: `valid-${suffix}@example.com` } });
      expect(imported.invitationCode).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(imported.maxGuests).toBe(3);
      expect(imported.plusOneAllowed).toBe(true);
      expect((await importGuests(ownerId, eventAId, csv))?.imported).toBe(0);
      expect(await db.guest.count({ where: { eventId: eventAId } })).toBe(before + 1);
      expect(await previewGuestCsvForEvent(otherId, eventAId, csv)).toBeNull();
      expect(await importGuests(otherId, eventAId, csv)).toBeNull();
    } finally {
      if (eventAId || eventBId) await db.guest.deleteMany({ where: { eventId: { in: [eventAId, eventBId].filter(Boolean) } } });
      if (eventAId || eventBId) await db.event.deleteMany({ where: { id: { in: [eventAId, eventBId].filter(Boolean) } } });
      if (designId) await db.design.deleteMany({ where: { id: designId } });
      if (ownerId || otherId) await db.user.deleteMany({ where: { id: { in: [ownerId, otherId].filter(Boolean) } } });
    }
  });
});
