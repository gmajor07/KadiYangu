import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
import {safeScannerDatabase,scannerFixture,cleanupScannerFixture} from "./scanner-fixture";
import {allocateGuestEntryPasses,personalizedEntryPasses,personalizedEntryToken,organizerEntryToken} from "@/services/guest-entry-passes";
import {createPersonalizedRsvp,createRsvp} from "@/services/events";
import {checkInGuestPass,replaceGuestPassToken,revokeGuestPass,issueGuestPasses} from "@/services/guest-passes-qr";
describe.skipIf(!safeScannerDatabase())("unified guest-to-gate isolated PostgreSQL",()=>{
 beforeEach(()=>{vi.stubEnv("AUTH_SECRET","guest-entry-integration-key-at-least-32-characters");vi.stubEnv("ENTRY_PASS_ENCRYPTION_KEY","");});
 afterEach(()=>vi.unstubAllEnvs());
 async function setup(){const f=await scannerFixture();await f.db.event.update({where:{id:f.event.id},data:{status:"PUBLISHED"}});await f.db.guestPass.updateMany({where:{purchaseId:f.purchase.id},data:{guestName:null}});return f;}
 async function cleanup(f:Awaited<ReturnType<typeof setup>>){await f.db.auditLog.deleteMany({where:{entityId:{in:f.passes.map(p=>p.id)}}});await f.db.rsvp.deleteMany({where:{eventId:{in:[f.event.id,f.otherEvent.id]}}});await cleanupScannerFixture(f);}
 it("requires explicit allocation after RSVP, then returns the same real token repeatedly",async()=>{
  const f=await setup();try{
   expect((await personalizedEntryPasses(f.event.slug,f.guest.invitationCode))?.reason).toContain("RSVP first");
   expect((await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1)).ok).toBe(false);
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:1});
   expect((await personalizedEntryPasses(f.event.slug,f.guest.invitationCode))?.reason).toContain("No entry pass");
   const before=await f.db.guestPassPurchase.findUniqueOrThrow({where:{id:f.purchase.id}});
   expect((await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1)).ok).toBe(true);
   const first=await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1);expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
   expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1)).toBe(first);
   expect((await personalizedEntryPasses(f.event.slug,f.guest.invitationCode))?.passes[0]).toMatchObject({available:true,status:"ACTIVE"});
   const row=await f.db.guestPass.findFirstOrThrow({where:{guestId:f.guest.id}});expect(row.tokenEnvelope).not.toContain(first!);
   expect(await f.db.guestPassPurchase.findUnique({where:{id:f.purchase.id}})).toEqual(before);
   expect(await checkInGuestPass(f.staff.id,f.event.id,first!)).toMatchObject({ok:true});expect(await checkInGuestPass(f.staff.id,f.event.id,first!)).toMatchObject({reason:"ALREADY_USED"});
  }finally{await cleanup(f);}
 });
 it("does not allocate twice under concurrency or exceed RSVP/plus-one/purchase limits",async()=>{
  const f=await setup();try{
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:2});
   const results=await Promise.all(Array.from({length:4},()=>allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,2)));expect(results.every(r=>r.ok)).toBe(true);
   expect(await f.db.guestPass.count({where:{guestId:f.guest.id}})).toBe(2);expect(await f.db.guestPass.count({where:{purchaseId:f.purchase.id}})).toBe(3);
   expect((await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,3)).ok).toBe(false);
   await f.db.guest.update({where:{id:f.guest.id},data:{plusOneAllowed:false}});expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,2)).toBeNull();
   expect(await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:2})).toBeNull();
   expect(await issueGuestPasses(f.owner.id,f.event.id,1,f.purchase.id)).toBeNull();
  }finally{await cleanup(f);}
 });
 it("blocks declined RSVP, invalid identity, wrong event and unauthorized organizer access",async()=>{
  const f=await setup();try{
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:1});await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1);
   const token=(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1))!;
   expect(await personalizedEntryToken(f.event.slug,"wrong-code",1)).toBeNull();expect(await personalizedEntryToken(f.otherEvent.slug,f.guest.invitationCode,1)).toBeNull();expect(await organizerEntryToken(f.other.id,f.event.id,f.guest.id,1)).toBeNull();expect((await allocateGuestEntryPasses(f.other.id,f.event.id,f.guest.id,1)).ok).toBe(false);
   expect(await checkInGuestPass(f.owner.id,f.otherEvent.id,token)).toMatchObject({detail:"WRONG_EVENT"});
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"NOT_ATTENDING",guestCount:1});expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1)).toBeNull();expect(await checkInGuestPass(f.owner.id,f.event.id,token)).toMatchObject({reason:"NOT_ELIGIBLE"});
   expect(await f.db.checkIn.count({where:{eventId:f.event.id}})).toBe(0);
  }finally{await cleanup(f);}
 });
 it("keeps replacement linked, invalidates old QR, and never regenerates revoked passes",async()=>{
  const f=await setup();try{
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:1});await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1);
   const old=(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1))!;const pass=await f.db.guestPass.findFirstOrThrow({where:{guestId:f.guest.id}});
   const replacement=await replaceGuestPassToken(f.owner.id,pass.id,pass.replacementRevision);expect(replacement).not.toBeNull();expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1)).toBe(replacement!.token);expect(await checkInGuestPass(f.owner.id,f.event.id,old)).toMatchObject({reason:"INVALID"});
   await revokeGuestPass(f.owner.id,pass.id);expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1)).toBeNull();await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1);expect(await f.db.guestPass.count({where:{guestId:f.guest.id}})).toBe(1);expect(await checkInGuestPass(f.owner.id,f.event.id,replacement!.token)).toMatchObject({reason:"REVOKED"});
  }finally{await cleanup(f);}
 });
 it("prevents public RSVP from changing a personalized guest's identity or entitlement",async()=>{
  const f=await setup();try{
   const personal=await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:1});
   await createRsvp(f.event.id,{guestName:"Impersonator",phone:f.guest.phone!,status:"NOT_ATTENDING",guestCount:1});
   expect(await f.db.rsvp.findUnique({where:{id:personal!.id}})).toMatchObject({guestId:f.guest.id,status:"ATTENDING",guestName:f.guest.name});
   expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1)).toBeNull();
  }finally{await cleanup(f);}
 });
 it("cannot oversell paid issuance or allocate more than actual purchased inventory",async()=>{
  const f=await setup();try{
   await f.db.guestPass.deleteMany({where:{purchaseId:f.purchase.id}});
   await f.db.guestPassPurchase.update({where:{id:f.purchase.id},data:{status:"ISSUED",quantityPurchased:1,quantityIssued:0,quantityRemaining:1}});
   const issued=await Promise.all(Array.from({length:4},()=>issueGuestPasses(f.owner.id,f.event.id,1,f.purchase.id)));
   expect(issued.filter(Boolean)).toHaveLength(1);expect(await f.db.guestPass.count({where:{purchaseId:f.purchase.id}})).toBe(1);
   expect(await f.db.guestPassPurchase.findUnique({where:{id:f.purchase.id}})).toMatchObject({quantityIssued:1,quantityRemaining:0});
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:2});
   expect((await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,2)).ok).toBe(false);
   expect(await f.db.guestPass.count({where:{guestId:f.guest.id}})).toBe(0);
   expect((await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1)).ok).toBe(true);
   expect(await f.db.guestPass.count({where:{purchaseId:f.purchase.id}})).toBe(1);
  }finally{await cleanup(f);}
 });
 it("blocks backing purchase cancellation and decline after a recorded admission",async()=>{
  const f=await setup();try{
   await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"ATTENDING",guestCount:1});await allocateGuestEntryPasses(f.owner.id,f.event.id,f.guest.id,1);
   const token=(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1))!;
   await f.db.guestPassPurchase.update({where:{id:f.purchase.id},data:{status:"CANCELLED"}});expect(await personalizedEntryToken(f.event.slug,f.guest.invitationCode,1)).toBeNull();expect(await checkInGuestPass(f.owner.id,f.event.id,token)).toMatchObject({reason:"NOT_ELIGIBLE"});
   await f.db.guestPassPurchase.update({where:{id:f.purchase.id},data:{status:"BETA_ISSUED"}});expect(await checkInGuestPass(f.owner.id,f.event.id,token)).toMatchObject({ok:true});expect(await createPersonalizedRsvp(f.event.slug,f.guest.invitationCode,{status:"NOT_ATTENDING",guestCount:1})).toBeNull();
  }finally{await cleanup(f);}
 });
});
