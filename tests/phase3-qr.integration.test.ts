import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createGuestPassOrder, allocateVerifiedGuestPasses } from "@/services/guest-passes";
import { issueGuestPasses, checkInGuestPass, revokeGuestPass } from "@/services/guest-passes-qr";

const enabled = process.env.ALLOW_GUEST_DB_TESTS === "true";

describe("Phase 3 QR PostgreSQL security integration", () => {
  it.skipIf(!enabled)("enforces issuance, capacity, authorization and atomic check-in", async () => {
    const db = getDb(); const s = randomUUID();
    let ownerId="", otherId="", designId="", eventId="", otherEventId="";
    const orderIds:string[]=[]; const paymentIds:string[]=[]; const purchaseIds:string[]=[]; const passIds:string[]=[];
    try {
      const owner=await db.user.create({data:{name:"QR Owner",email:`qr-owner-${s}@example.com`,passwordHash:"test",role:"USER",status:"ACTIVE"}}); ownerId=owner.id;
      const other=await db.user.create({data:{name:"QR Other",email:`qr-other-${s}@example.com`,passwordHash:"test",role:"USER",status:"ACTIVE"}}); otherId=other.id;
      const design=await db.design.create({data:{userId:ownerId,name:`QR Design ${s}`,width:1080,height:1350,orientation:"PORTRAIT",designData:{version:1},status:"DRAFT"}}); designId=design.id;
      const event=await db.event.create({data:{userId:ownerId,designId,title:`QR Event ${s}`,slug:`qr-${s}`,eventType:"Other",eventDate:new Date("2035-01-01")}}); eventId=event.id;
      const otherEvent=await db.event.create({data:{userId:ownerId,designId,title:`QR Other Event ${s}`,slug:`qr-other-${s}`,eventType:"Other",eventDate:new Date("2035-01-02")}}); otherEventId=otherEvent.id;
      const order=await createGuestPassOrder(ownerId,eventId,3,`qr-idem-${s}`); expect(order).toBeTruthy(); if(!order)return; orderIds.push(order.id);
      const payment=await db.payment.create({data:{orderId:order.id,provider:"MANUAL_TEST",amount:order.total,currency:order.currency,status:"SUCCESS",providerReference:`qr-pay-${s}`}}); paymentIds.push(payment.id);
      expect((await allocateVerifiedGuestPasses(payment.id)).ok).toBe(true);
      const purchase=await db.guestPassPurchase.findUniqueOrThrow({where:{orderId:order.id}}); purchaseIds.push(purchase.id);
      const issued=await issueGuestPasses(ownerId,eventId,2,purchase.id); expect(issued).toHaveLength(2); if(!issued)return; passIds.push(...(await Promise.all(issued.map(p=>db.guestPass.findUniqueOrThrow({where:{tokenHash:p.tokenHash}}))).then(rows=>rows.map(r=>r.id))));
      const concurrentIssue=await Promise.all([issueGuestPasses(ownerId,eventId,1,purchase.id),issueGuestPasses(ownerId,eventId,1,purchase.id)]);
      expect(concurrentIssue.filter(Boolean)).toHaveLength(1); if(concurrentIssue[0])passIds.push((await db.guestPass.findUniqueOrThrow({where:{tokenHash:concurrentIssue[0][0].tokenHash}})).id); if(concurrentIssue[1])passIds.push((await db.guestPass.findUniqueOrThrow({where:{tokenHash:concurrentIssue[1][0].tokenHash}})).id);
      expect(await issueGuestPasses(ownerId,eventId,1,purchase.id)).toBeNull();
      const first=issued[0];
      expect((await checkInGuestPass(ownerId,eventId,first.token)).ok).toBe(true);
      expect((await checkInGuestPass(ownerId,eventId,first.token)).reason).toBe("ALREADY_USED");
      const revoked=issued[1]; const revokedPass=await db.guestPass.findUniqueOrThrow({where:{tokenHash:revoked.tokenHash}}); await revokeGuestPass(ownerId,revokedPass.id); expect((await db.guestPass.findUniqueOrThrow({where:{id:revokedPass.id}})).status).toBe("REVOKED"); expect((await checkInGuestPass(ownerId,eventId,revoked.token)).reason).toBe("REVOKED");
      const concurrentToken=(concurrentIssue.find(Boolean) as any)[0].token;
      const concurrent=await Promise.all([checkInGuestPass(ownerId,eventId,concurrentToken),checkInGuestPass(ownerId,eventId,concurrentToken)]);
      expect(concurrent.filter(r=>r.ok)).toHaveLength(1);
      expect((await checkInGuestPass(ownerId,otherEventId,first.token)).reason).toBe("INVALID");
      expect((await checkInGuestPass(otherId,eventId,first.token)).reason).toBe("UNAUTHORIZED");
      expect(await db.checkIn.count({where:{eventId}})).toBe(2);
      expect(await db.auditLog.count({where:{action:"GUEST_PASS_ALLOCATED",entityId:purchase.id}})).toBe(1);
    } finally {
      if(passIds.length) await db.checkIn.deleteMany({where:{passId:{in:passIds}}});
      if(passIds.length) await db.guestPass.deleteMany({where:{id:{in:passIds}}});
      if(purchaseIds.length) await db.auditLog.deleteMany({where:{entityId:{in:purchaseIds}}});
      if(paymentIds.length) await db.payment.deleteMany({where:{id:{in:paymentIds}}});
      if(purchaseIds.length) await db.guestPassPurchase.deleteMany({where:{id:{in:purchaseIds}}});
      if(orderIds.length) await db.orderItem.deleteMany({where:{orderId:{in:orderIds}}});
      if(orderIds.length) await db.order.deleteMany({where:{id:{in:orderIds}}});
      if(otherEventId) await db.event.deleteMany({where:{id:otherEventId}});
      if(eventId) await db.event.deleteMany({where:{id:eventId}});
      if(designId) await db.design.deleteMany({where:{id:designId}});
      if(otherId) await db.user.deleteMany({where:{id:otherId}});
      if(ownerId) await db.user.deleteMany({where:{id:ownerId}});
    }
  });
});
