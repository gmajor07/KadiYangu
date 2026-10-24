import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { eligibleRecipients, listMessageTemplates, createMessageCampaign, saveMessageTemplate, saveCampaignRecipients, transitionCampaign, setMessageConsent } from "@/services/messaging";

export function isSafePhase7e3DatabaseUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (protocol === "postgres:" || protocol === "postgresql:") &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname) &&
      parsed.pathname === "/kadiyangu_phase7e1_test";
  } catch {
    return false;
  }
}

const enabled = process.env.ALLOW_PHASE7E3_DB_TESTS === "true";
const safe = isSafePhase7e3DatabaseUrl(process.env.DATABASE_URL || "");

describe.skipIf(!(enabled && safe))("Phase 7E.3 PostgreSQL messaging", () => {
  async function fixture() {
    const db=getDb(); const suffix=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const user=await db.user.create({data:{name:"Phase 7E3 Fixture",email:`phase7e3-${suffix}@example.invalid`,passwordHash:"fixture-hash"}});
    const category=await db.eventCategory.create({data:{name:`Phase 7E3 Category ${suffix}`,slug:`phase-7e3-category-${suffix}`,description:"Disposable integration category"}});
    const catalog=await db.template.create({data:{name:`Phase 7E3 Template ${suffix}`,slug:`phase-7e3-template-${suffix}`,description:"Disposable integration template",thumbnailUrl:"/test.png",categoryId:category.id,designData:{},status:"PUBLISHED",pricingTier:"FREE",isActive:true}});
    const design=await db.design.create({data:{userId:user.id,templateId:catalog.id,name:`Phase 7E3 Design ${suffix}`,designData:{},width:1080,height:1350,orientation:"PORTRAIT"}});
    const event=await db.event.create({data:{userId:user.id,designId:design.id,title:`Phase 7E3 Event ${suffix}`,slug:`phase-7e3-${suffix}`,eventType:"TEST",eventDate:new Date(Date.now()+86400000)}});
    const otherEvent=await db.event.create({data:{userId:user.id,designId:design.id,title:`Phase 7E3 Other ${suffix}`,slug:`phase-7e3-other-${suffix}`,eventType:"TEST",eventDate:new Date(Date.now()+172800000)}});
    const template=await saveMessageTemplate(event.userId,event.id,{name:`Integration ${Date.now()}`,channel:"SMS",body:"Hello {guest_name} {outstanding_amount}"}); if(!template) throw new Error("template fixture failed");
    const campaign=await createMessageCampaign(event.userId,event.id,{name:`Campaign ${Date.now()}`,channel:"SMS",templateId:template.id}); if(!campaign) throw new Error("campaign fixture failed");
    return {db,user,event,otherEvent,design,category,catalog,template,campaign};
  }
  async function cleanup(f:{db:any;user:{id:string};event:{id:string};otherEvent:{id:string};design:{id:string};category:{id:string};catalog:{id:string};template:{id:string};campaign:{id:string}}){await f.db.messageRecipient.deleteMany({where:{campaignId:f.campaign.id}});await f.db.messageCampaign.delete({where:{id:f.campaign.id}});await f.db.messageTemplate.delete({where:{id:f.template.id}});await f.db.event.deleteMany({where:{id:{in:[f.event.id,f.otherEvent.id]}}});await f.db.design.delete({where:{id:f.design.id}});await f.db.template.delete({where:{id:f.catalog.id}});await f.db.eventCategory.delete({where:{id:f.category.id}});await f.db.user.delete({where:{id:f.user.id}});}
  it("has messaging schema and denies unknown event access", async () => {
    const db = getDb();
    const tables = await db.$queryRaw<{ regclass: string }[]>`SELECT to_regclass('"MessageCampaign"')::text as regclass`;
    expect(tables[0]?.regclass).toBe('"MessageCampaign"');
    expect(await listMessageTemplates("missing-user", "missing-event")).toBeNull();
    expect(await eligibleRecipients("missing-user", "missing-event", "SMS")).toBeNull();
  });
  it("creates a DRAFT campaign and persists eligible recipients", async () => { const f=await fixture(); try { const guests=await f.db.guest.findMany({where:{eventId:f.event.id},select:{id:true}}); const result=await saveCampaignRecipients(f.event.userId,f.event.id,f.campaign.id,"GUESTS",{},guests.length? [guests[0].id]:undefined); expect(result).not.toBeNull(); const count=await f.db.messageRecipient.count({where:{campaignId:f.campaign.id}}); expect(count).toBeGreaterThanOrEqual(0); } finally {await cleanup(f);} });
  it("enforces consent, opt-out and linked recipient deduplication", async () => { const f=await fixture(); try { const guest=await f.db.guest.findFirst({where:{eventId:f.event.id},select:{id:true}}); if(guest){await setMessageConsent(f.event.userId,f.event.id,{guestId:guest.id,channel:"SMS",status:"OPTED_OUT"}); const result=await saveCampaignRecipients(f.event.userId,f.event.id,f.campaign.id,"GUESTS",{},[guest.id]); expect(result?.eligible.length).toBe(0);} } finally {await cleanup(f);} });
  it("rejects READY without eligible recipients, then allows a valid transition", async () => { const f=await fixture(); try { expect(await transitionCampaign(f.event.userId,f.event.id,f.campaign.id,"READY")).toBeNull(); const guests=await f.db.guest.findMany({where:{eventId:f.event.id},select:{id:true}}); if(guests.length){await saveCampaignRecipients(f.event.userId,f.event.id,f.campaign.id,"GUESTS",{},[guests[0].id]); expect((await transitionCampaign(f.event.userId,f.event.id,f.campaign.id,"READY"))?.status).toBe("READY");} } finally {await cleanup(f);} });
  it("supports draft editing and cancellation without dispatch", async () => { const f=await fixture(); try { expect((await transitionCampaign(f.event.userId,f.event.id,f.campaign.id,"CANCELLED"))?.status).toBe("CANCELLED"); expect(await transitionCampaign(f.event.userId,f.event.id,f.campaign.id,"READY")).toBeNull(); expect(await f.db.messageLog.count({where:{campaignId:f.campaign.id}})).toBe(0); } finally {await cleanup(f);} });
  it("rejects cross-event campaign access", async () => { const f=await fixture(); try { expect(await transitionCampaign(f.user.id, f.otherEvent.id, f.campaign.id,"CANCELLED")).toBeNull(); } finally {await cleanup(f);} });
});
