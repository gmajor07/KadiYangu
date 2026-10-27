import {describe,expect,it} from "vitest";
import {safeScannerDatabase,scannerFixture,cleanupScannerFixture} from "./scanner-fixture";
import {resolveScannerEvent} from "@/services/scanner";
import {checkInGuestPass} from "@/services/guest-passes-qr";
describe.skipIf(!safeScannerDatabase())("isolated PostgreSQL scanner security",()=>{
 it("rejects unauthorized IDs and invitation QR, allowing event owner/staff only",async()=>{
  const f=await scannerFixture();try{
   expect((await resolveScannerEvent(f.owner.id,f.event.id)).kind).toBe("selected");expect((await resolveScannerEvent(f.staff.id,f.event.id)).kind).toBe("selected");expect((await resolveScannerEvent(f.other.id,f.event.id)).kind).toBe("denied");
   const before=await f.db.checkIn.count({where:{eventId:f.event.id}});
   expect(await checkInGuestPass(f.other.id,f.event.id,f.tokens[0])).toMatchObject({ok:false,reason:"UNAUTHORIZED"});
   expect(await checkInGuestPass(f.owner.id,f.event.id,`https://example.invalid/i/event/g/${f.guest.invitationCode}`)).toMatchObject({ok:false,reason:"INVALID"});
   expect(await checkInGuestPass(f.owner.id,f.otherEvent.id,f.tokens[0])).toMatchObject({ok:false,detail:"WRONG_EVENT"});
   expect(await f.db.checkIn.count({where:{eventId:f.event.id}})).toBe(before);
   expect(await f.db.guestPass.findUnique({where:{id:f.passes[0].id}})).toMatchObject({status:"ACTIVE"});
  }finally{await cleanupScannerFixture(f);}
 });
 it("records one check-in under simultaneous duplicate requests and preserves one-pass capacity",async()=>{
  const f=await scannerFixture();try{
   const results=await Promise.all(Array.from({length:6},()=>checkInGuestPass(f.staff.id,f.event.id,f.tokens[0])));
   expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.filter(r=>!r.ok && r.reason==="ALREADY_USED")).toHaveLength(5);
   expect(results.find(r=>r.ok)).toMatchObject({entry:{guestName:"Asha",allowedEntries:1,checkedIn:1,remaining:0}});
   expect(await f.db.checkIn.count({where:{passId:f.passes[0].id}})).toBe(1);
   expect(await f.db.guest.findUnique({where:{id:f.guest.id}})).toMatchObject({maxGuests:3,plusOneAllowed:true});
   expect(await f.db.guestPassPurchase.findUnique({where:{id:f.purchase.id}})).toMatchObject({quantityPurchased:3,quantityRemaining:0});
   expect(await checkInGuestPass(f.owner.id,f.event.id,f.tokens[1])).toMatchObject({ok:true});expect(await f.db.checkIn.count({where:{eventId:f.event.id}})).toBe(2);
  }finally{await cleanupScannerFixture(f);}
 });
});
