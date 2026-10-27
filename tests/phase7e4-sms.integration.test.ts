import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {getDb} from "@/lib/db";
import {prepareSmsQueue,processMockSmsJob} from "@/services/sms-queue";
const safe = (()=>{try{const url=new URL(process.env.DATABASE_URL || "");return ["postgres:","postgresql:"].includes(url.protocol)&&["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&url.pathname==="/kadiyangu_phase7e1_test";}catch{return false;}})();
describe.skipIf(process.env.ALLOW_PHASE7E4_DB_TESTS!=="true" || !safe)("Phase 7E.4 isolated PostgreSQL queue",()=>{
 beforeEach(()=>{vi.stubEnv("SMS_DISPATCH_MODE","mock");vi.stubEnv("SMS_MOCK_DISPATCH_ENABLED","true");vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("Network forbidden");}));});
 afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllEnvs();vi.unstubAllGlobals();});
 async function fixture(){
  const db=getDb(), suffix=`sms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user=await db.user.create({data:{email:`${suffix}@example.invalid`,name:"SMS test",passwordHash:"test"}});
  const category=await db.eventCategory.create({data:{name:suffix,slug:suffix,description:"test"}});
  const template=await db.template.create({data:{name:suffix,slug:suffix,description:"test",thumbnailUrl:"/test.png",categoryId:category.id,designData:{}}});
  const design=await db.design.create({data:{userId:user.id,templateId:template.id,name:suffix,designData:{},width:100,height:100,orientation:"PORTRAIT"}});
  const event=await db.event.create({data:{userId:user.id,designId:design.id,title:suffix,slug:suffix,eventType:"TEST",eventDate:new Date()}});
  const guest=await db.guest.create({data:{eventId:event.id,name:"Asha",phone:"0712345678",invitationCode:suffix}});
  await db.messageConsent.create({data:{eventId:event.id,guestId:guest.id,channel:"SMS",status:"OPTED_IN"}});
  const messageTemplate=await db.messageTemplate.create({data:{eventId:event.id,name:"Test",channel:"SMS",body:"Hello"}});
  const campaign=await db.messageCampaign.create({data:{eventId:event.id,name:"Test",channel:"SMS",templateId:messageTemplate.id,status:"READY"}});
  const recipient=await db.messageRecipient.create({data:{campaignId:campaign.id,guestId:guest.id,destination:"255712345678",renderedBody:"Hello"}});
  return {db,user,category,template,design,event,guest,messageTemplate,campaign,recipient};
 }
 async function cleanup(f:Awaited<ReturnType<typeof fixture>>){
  await f.db.auditLog.deleteMany({where:{actorUserId:f.user.id}});
  await f.db.messageLog.deleteMany({where:{eventId:f.event.id}});
  await f.db.messageRecipient.deleteMany({where:{campaignId:f.campaign.id}});
  await f.db.messageCampaign.delete({where:{id:f.campaign.id}});
  await f.db.messageTemplate.delete({where:{id:f.messageTemplate.id}});
  await f.db.messageConsent.deleteMany({where:{eventId:f.event.id}});
  await f.db.guest.delete({where:{id:f.guest.id}});await f.db.event.delete({where:{id:f.event.id}});
  await f.db.design.delete({where:{id:f.design.id}});await f.db.template.delete({where:{id:f.template.id}});await f.db.eventCategory.delete({where:{id:f.category.id}});await f.db.user.delete({where:{id:f.user.id}});
 }
 it("serializes concurrent queue preparation and concurrent mock claims",async()=>{
  const f=await fixture();try{
   await Promise.all([prepareSmsQueue(f.user.id,f.event.id,f.campaign.id),prepareSmsQueue(f.user.id,f.event.id,f.campaign.id)]);
   expect(await f.db.messageLog.count({where:{recipientId:f.recipient.id}})).toBe(1);
   const results=await Promise.all([processMockSmsJob(f.user.id,f.event.id,f.recipient.id),processMockSmsJob(f.user.id,f.event.id,f.recipient.id)]);
   expect(results.filter(r=>r.ok)).toHaveLength(1);
   expect(await f.db.messageRecipient.findUnique({where:{id:f.recipient.id}})).toMatchObject({smsAttempts:1,smsJobState:"COMPLETE",smsMode:"MOCK",status:"QUEUED"});
  }finally{await cleanup(f);}
 });
 it("blocks DRAFT, CANCELLED, unauthorized access and consent revoked after queueing",async()=>{
  const f=await fixture();try{
   expect((await prepareSmsQueue("missing-user",f.event.id,f.campaign.id)).ok).toBe(false);
   for(const status of ["DRAFT","CANCELLED"] as const){await f.db.messageCampaign.update({where:{id:f.campaign.id},data:{status}});expect((await prepareSmsQueue(f.user.id,f.event.id,f.campaign.id)).ok).toBe(false);}
   await f.db.messageCampaign.update({where:{id:f.campaign.id},data:{status:"READY"}});await prepareSmsQueue(f.user.id,f.event.id,f.campaign.id);
   await f.db.messageConsent.updateMany({where:{eventId:f.event.id},data:{status:"OPTED_OUT"}});
   expect(await processMockSmsJob(f.user.id,f.event.id,f.recipient.id)).toMatchObject({state:"FAILED"});
  }finally{await cleanup(f);}
 });
});
