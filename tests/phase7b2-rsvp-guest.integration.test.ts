import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { associateRsvpWithGuest, expectedGuestCount } from "@/services/events";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 7B.2 Guest/Rsvp relationship", () => {
  it.skipIf(!enabled)("supports anonymous and same-event Guest RSVPs safely", async () => {
    const db = getDb();
    const suffix = randomUUID();
    let userId = "", designId = "", eventAId = "", eventBId = "", guestAId = "", guestBId = "", rsvpAId = "", anonymousId = "";
    try {
      const user = await db.user.create({ data: { name: "RSVP Relation Owner", email: `rsvp-rel-${suffix}@example.com`, passwordHash: "test", role: "USER", status: "ACTIVE" } }); userId = user.id;
      const design = await db.design.create({ data: { userId, name: `RSVP Relation Design ${suffix}`, width: 1080, height: 1350, orientation: "PORTRAIT", designData: { version: 1 }, status: "DRAFT" } }); designId = design.id;
      const a = await db.event.create({ data: { userId, designId, title: "Relation A", slug: `rsvp-rel-a-${suffix}`, eventType: "Wedding", eventDate: new Date("2030-01-01"), status: "PUBLISHED" } }); eventAId = a.id;
      const b = await db.event.create({ data: { userId, designId, title: "Relation B", slug: `rsvp-rel-b-${suffix}`, eventType: "Wedding", eventDate: new Date("2030-01-02"), status: "PUBLISHED" } }); eventBId = b.id;
      const guestA = await db.guest.create({ data: { eventId: eventAId, name: "Guest A", invitationCode: `rsvp-ga-${suffix}` } }); guestAId = guestA.id;
      const guestB = await db.guest.create({ data: { eventId: eventBId, name: "Guest B", invitationCode: `rsvp-gb-${suffix}` } }); guestBId = guestB.id;
      const rsvp = await db.rsvp.create({ data: { eventId: eventAId, guestName: "Guest A", status: "ATTENDING", guestCount: 2 } }); rsvpAId = rsvp.id;
      const anonymous = await db.rsvp.create({ data: { eventId: eventAId, guestName: "Anonymous", status: "NOT_ATTENDING", guestCount: 1 } }); anonymousId = anonymous.id;
      expect(await associateRsvpWithGuest(eventAId, rsvpAId, guestAId)).toMatchObject({ guestId: guestAId });
      expect(await associateRsvpWithGuest(eventAId, rsvpAId, guestBId)).toBeNull();
      await expect(db.rsvp.create({ data: { eventId: eventAId, guestId: guestAId, guestName: "Duplicate", status: "ATTENDING", guestCount: 1 } })).rejects.toMatchObject({ code: "P2002" });
      expect(await db.rsvp.findUniqueOrThrow({ where: { id: anonymousId } })).toMatchObject({ guestId: null });
      expect(expectedGuestCount([{ status: "ATTENDING", guestCount: 2 }, { status: "NOT_ATTENDING", guestCount: 4 }])).toBe(2);
      await db.guest.delete({ where: { id: guestAId } });
      expect(await db.rsvp.findUniqueOrThrow({ where: { id: rsvpAId } })).toMatchObject({ guestId: null });
    } finally {
      if (eventAId || eventBId) await db.rsvp.deleteMany({ where: { eventId: { in: [eventAId, eventBId].filter(Boolean) } } });
      if (eventAId || eventBId) await db.guest.deleteMany({ where: { eventId: { in: [eventAId, eventBId].filter(Boolean) } } });
      if (eventAId || eventBId) await db.event.deleteMany({ where: { id: { in: [eventAId, eventBId].filter(Boolean) } } });
      if (designId) await db.design.deleteMany({ where: { id: designId } });
      if (userId) await db.user.deleteMany({ where: { id: userId } });
    }
  });
});
