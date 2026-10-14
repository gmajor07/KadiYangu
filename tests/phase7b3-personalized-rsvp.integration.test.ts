import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createPersonalizedRsvp, getPersonalizedEvent, expectedGuestCount } from "@/services/events";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 7B.3 personalized RSVP", () => {
  it.skipIf(!enabled)("resolves Guest by invitation, upserts one RSVP, and enforces maxGuests", async () => {
    const db = getDb(); const suffix = randomUUID();
    let userId="",designId="",eventAId="",eventBId="",guestAId="",guestBId="";
    const code=`personal-${suffix}`;
    try {
      const user=await db.user.create({data:{name:"Personal RSVP Owner",email:`personal-${suffix}@example.com`,passwordHash:"test",role:"USER",status:"ACTIVE"}});userId=user.id;
      const design=await db.design.create({data:{userId,name:`Personal Design ${suffix}`,width:1080,height:1350,orientation:"PORTRAIT",designData:{version:1},status:"DRAFT"}});designId=design.id;
      const a=await db.event.create({data:{userId,designId,title:"Personal A",slug:`personal-a-${suffix}`,eventType:"Wedding",eventDate:new Date("2030-01-01"),status:"PUBLISHED"}});eventAId=a.id;
      const b=await db.event.create({data:{userId,designId,title:"Personal B",slug:`personal-b-${suffix}`,eventType:"Wedding",eventDate:new Date("2030-01-02"),status:"PUBLISHED"}});eventBId=b.id;
      const ga=await db.guest.create({data:{eventId:eventAId,name:"Guest A",maxGuests:2,invitationCode:code}});guestAId=ga.id;
      const gb=await db.guest.create({data:{eventId:eventBId,name:"Guest B",invitationCode:`other-${suffix}`}});guestBId=gb.id;
      expect((await getPersonalizedEvent(a.slug,code))?.guests[0].name).toBe("Guest A");
      expect(await db.rsvp.count({where:{eventId:eventAId}})).toBe(0);
      const first=await createPersonalizedRsvp(a.slug,code,{status:"ATTENDING",guestCount:2});expect(first?.guestId).toBe(guestAId);expect(first?.guestCount).toBe(2);
      await expect(createPersonalizedRsvp(a.slug,code,{status:"ATTENDING",guestCount:3})).resolves.toBeNull();
      const second=await createPersonalizedRsvp(a.slug,code,{status:"NOT_ATTENDING",guestCount:1});expect(second?.id).toBe(first?.id);expect(second?.status).toBe("NOT_ATTENDING");
      const third=await createPersonalizedRsvp(a.slug,code,{status:"ATTENDING",guestCount:1});expect(third?.id).toBe(first?.id);
      expect(await db.rsvp.count({where:{eventId:eventAId,guestId:guestAId}})).toBe(1);
      expect(expectedGuestCount(await db.rsvp.findMany({where:{eventId:eventAId},select:{status:true,guestCount:true}}))).toBe(1);
      expect(await createPersonalizedRsvp(b.slug,code,{status:"ATTENDING",guestCount:1})).toBeNull();
    } finally {
      if(eventAId||eventBId)await db.rsvp.deleteMany({where:{eventId:{in:[eventAId,eventBId].filter(Boolean)}}});
      if(eventAId||eventBId)await db.guest.deleteMany({where:{eventId:{in:[eventAId,eventBId].filter(Boolean)}}});
      if(eventAId||eventBId)await db.event.deleteMany({where:{id:{in:[eventAId,eventBId].filter(Boolean)}}});
      if(designId)await db.design.deleteMany({where:{id:designId}}); if(userId)await db.user.deleteMany({where:{id:userId}});
    }
  });
});
