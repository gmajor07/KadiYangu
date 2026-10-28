import "server-only";
import {randomBytes} from "node:crypto";
import type {Prisma} from "@prisma/client";
import {getDb} from "@/lib/db";
import {canManageEvent} from "@/services/events";
import {guestEntryLimit} from "@/lib/guest-entry-policy";
import {entryTokenHash,openEntryToken,passRetrievalConfigured,sealEntryToken} from "@/lib/entry-pass-crypto";
const roles=["OWNER","ADMIN","MANAGER","EDITOR"];
export const guestPassInclude={rsvps:{orderBy:[{updatedAt:"desc" as const},{id:"asc" as const}],select:{status:true,guestCount:true}}};
export type EntryPassView={guestName:string;eventName:string;limit:number;reason:string|null;passes:Array<{slot:number;status:string;available:boolean;reason:string|null}>};
async function view(tx:Prisma.TransactionClient,eventId:string,guestId:string):Promise<EntryPassView|null>{
 const guest=await tx.guest.findFirst({where:{id:guestId,eventId},include:{...guestPassInclude,event:{select:{title:true,status:true}}}});
 if(!guest)return null;
 const rows=await tx.guestPass.findMany({where:{eventId,guestId},orderBy:{guestSlot:"asc"},include:{purchase:{select:{status:true}}}});
 const limit=guestEntryLimit(guest);
 const reason=guest.event.status!=="PUBLISHED"?"This event is not published. Contact the organizer.":!guest.rsvps.length?"RSVP first. Accepting an invitation does not allocate an entry pass.":guest.rsvps[0].status!=="ATTENDING"?"Your RSVP is declined. Update your RSVP to attending, then ask the organizer to confirm your entry pass.":!rows.length?"No entry pass has been allocated to you. Ask the organizer to allocate an issued entry pass.":!passRetrievalConfigured()?"Secure pass retrieval is unavailable. Contact the organizer.":null;
 return {guestName:guest.name,eventName:guest.event.title,limit,reason,passes:rows.map(pass=>{
  const problem=reason || (pass.status==="REVOKED"?"This pass was revoked. Contact the organizer.":pass.status==="CHECKED_IN"?"Already checked in. This pass cannot admit another person.":pass.guestSlot!>limit?"This pass is outside your current RSVP party limit.":!["ISSUED","BETA_ISSUED"].includes(pass.purchase.status)?"The purchase or allocation backing this pass is no longer active. Contact the organizer.":!pass.tokenEnvelope?"Secure retrieval has not been enabled for this pass. Ask the organizer to replace it.":!openEntryToken(pass.tokenEnvelope,pass,pass.tokenHash)?"Secure pass data could not be opened. Contact the organizer to replace this pass.":null);
  return {slot:pass.guestSlot!,status:pass.status,available:!problem,reason:problem};
 })};
}
export async function personalizedEntryPasses(slug:string,invitationCode:string){
 const db=getDb();
 const guest=await db.guest.findFirst({where:{invitationCode,event:{slug,status:"PUBLISHED"}},select:{id:true,eventId:true}});
 return guest?view(db,guest.eventId,guest.id):null;
}
export async function organizerEntryPasses(userId:string,eventId:string,guestId:string){
 if(!await canManageEvent(userId,eventId,roles))return null;
 return view(getDb(),eventId,guestId);
}

// Explicit organizer action only: bind already-issued, paid/beta-authorized inventory.
// Never mint passes, consume credit or alter purchase counters during RSVP/retrieval.
export async function allocateGuestEntryPasses(userId:string,eventId:string,guestId:string,quantity:number,sourcePassId?:string){
 if(!await canManageEvent(userId,eventId,roles))return {ok:false,error:"Guest or event unavailable."};
 if(!Number.isInteger(quantity)||quantity<1||quantity>10000)return {ok:false,error:"Invalid entry count."};
 if(!passRetrievalConfigured())return {ok:false,error:"Secure pass retrieval is not configured."};
 try{return await getDb().$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`guest-entry:${guestId}`},0))`;
  const guest=await tx.guest.findFirst({where:{id:guestId,eventId},include:{...guestPassInclude,event:{select:{status:true}}}});
  if(!guest || guest.event.status!=="PUBLISHED")return {ok:false,error:"Publish this event and confirm the guest's RSVP first."};
  const limit=guestEntryLimit(guest);
  if(!limit || quantity>limit)return {ok:false,error:"Entry count exceeds the attending RSVP or permitted plus-one limit."};
  const current=await tx.guestPass.findMany({where:{eventId,guestId},select:{id:true,guestSlot:true,status:true}});
  const missing=Array.from({length:quantity},(_,i)=>i+1).filter(slot=>!current.some(pass=>pass.guestSlot===slot));
  if(!missing.length)return {ok:true,success:"Entry passes are already allocated. Existing revoked/used passes were not regenerated."};
  if(sourcePassId && missing.length!==1)return {ok:false,error:"Link a selected legacy pass one slot at a time."};
  // Serialize inventory selection per event; locks also protect allocation across guests.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`guest-inventory:${eventId}`},0))`;
  const candidates=await tx.guestPass.findMany({where:{eventId,guestId:null,status:"ACTIVE",...(sourcePassId?{id:sourcePassId}:{guestName:null}),purchase:{status:{in:["ISSUED","BETA_ISSUED"]}}},orderBy:[{issuedAt:"asc"},{id:"asc"}],take:missing.length,select:{id:true,purchaseId:true}});
  if(candidates.length!==missing.length)return {ok:false,error:"Not enough unassigned issued passes. Use Manage Entry Passes to issue purchased/beta capacity, or explicitly link a legacy pass."};
  const purchaseIds=[...new Set(candidates.map(pass=>pass.purchaseId))].sort();
  for(const purchaseId of purchaseIds){
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pass-purchase:${purchaseId}`},0))`;
   const purchase=await tx.guestPassPurchase.findFirst({where:{id:purchaseId,eventId,status:{in:["ISSUED","BETA_ISSUED"]}}});
   const issued=await tx.guestPass.count({where:{purchaseId}});
   if(!purchase || issued>purchase.quantityPurchased || purchase.quantityIssued<purchase.quantityPurchased-purchase.quantityRemaining)return {ok:false,error:"Purchase inventory needs organizer review. No extra capacity was allocated."};
  }
  for(let i=0;i<candidates.length;i++){
   const candidate=candidates[i];
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${candidate.id},0))`;
   const pass=await tx.guestPass.findFirst({where:{id:candidate.id,eventId,guestId:null,status:"ACTIVE"}});
   if(!pass)throw new Error("INVENTORY_CHANGED");
   const raw=randomBytes(32).toString("base64url"),revision=pass.replacementRevision+1;
   await tx.guestPass.update({where:{id:pass.id},data:{guestId,guestSlot:missing[i],guestName:guest.name,guestEmail:guest.email,guestPhone:guest.phone,tokenHash:entryTokenHash(raw),replacementRevision:revision,tokenEnvelope:sealEntryToken(raw,{...pass,replacementRevision:revision})}});
   await tx.auditLog.create({data:{actorUserId:userId,action:"GUEST_ENTRY_PASS_LINKED",entityType:"GuestPass",entityId:pass.id,afterData:{eventId,guestId,slot:missing[i],oldQrInvalidated:true}}});
  }
  return {ok:true,success:`Allocated ${missing.length} entry pass(es). Previously shared QR codes for those passes are now invalid. The guest can open My Entry Pass.`};
 },{maxWait:5000,timeout:15000});}catch(error){
  if((error as {code?:string}).code==="P2002" || (error instanceof Error && error.message==="INVENTORY_CHANGED"))return {ok:false,error:"Inventory changed concurrently. Refresh and try again."};
  throw error;
 }
}

async function tokenForGuest(tx:Prisma.TransactionClient,eventId:string,guestId:string,slot:number){
 if(!Number.isInteger(slot)||slot<1)return null;
 const state=await view(tx,eventId,guestId);
 if(!state || !state.passes.some(pass=>pass.slot===slot && pass.available))return null;
 const pass=await tx.guestPass.findFirst({where:{eventId,guestId,guestSlot:slot,status:"ACTIVE"}});
 return pass?.tokenEnvelope?openEntryToken(pass.tokenEnvelope,pass,pass.tokenHash):null;
}
export async function personalizedEntryToken(slug:string,invitationCode:string,slot:number){
 return getDb().$transaction(async tx=>{
  const guest=await tx.guest.findFirst({where:{invitationCode,event:{slug,status:"PUBLISHED"}},select:{id:true,eventId:true}});
  if(!guest)return null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`guest-entry:${guest.id}`},0))`;
  return tokenForGuest(tx,guest.eventId,guest.id,slot);
 });
}
export async function organizerEntryToken(userId:string,eventId:string,guestId:string,slot:number){
 if(!await canManageEvent(userId,eventId,roles))return null;
 return getDb().$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`guest-entry:${guestId}`},0))`;
  return tokenForGuest(tx,eventId,guestId,slot);
 });
}
