import "server-only";
import { getDb } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireOrganizationMember } from "@/services/organizations";
import { consumeBetaQuota } from "@/services/beta";
function slugify(value:string){return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,150)||"event";}
export async function uniqueEventSlug(title:string){const base=slugify(title); let slug=base; for(let i=2; await getDb().event.findUnique({where:{slug}}); i++) slug=`${base}-${i}`; return slug;}
export async function createEvent(userId:string,input:{designId:string;title:string;eventType:string;eventDate:string;startTime?:string;endTime?:string;venue?:string;locationText?:string;description?:string;organizationId?:string}){
  if (input.organizationId && !(await requireOrganizationMember(userId, input.organizationId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"]))) return null;
  const betaQuota = await consumeBetaQuota(userId, input.organizationId ?? null, "EVENT");
  if (betaQuota === false) return null;
  const design=await getDb().design.findFirst({where:{id:input.designId,userId, status:{not:"ARCHIVED"}},select:{id:true,organizationId:true}});if(!design)return null;
  if ((input.organizationId && design.organizationId !== input.organizationId) || (!input.organizationId && design.organizationId)) return null;const slug=await uniqueEventSlug(input.title);return getDb().event.create({data:{userId, ...(input.organizationId ? { organizationId: input.organizationId } : {}), designId:design.id,title:input.title.trim(),slug,eventType:input.eventType,eventDate:new Date(input.eventDate),startTime:input.startTime||null,endTime:input.endTime||null,venue:input.venue||null,locationText:input.locationText||null,description:input.description||null}});}
export function listEvents(userId:string, organizationId?: string){return getDb().event.findMany({where:{userId, ...(organizationId ? { organizationId } : { organizationId: null })},include:{_count:{select:{responses:true}}},orderBy:{eventDate:"asc"}});}
export async function canManageEvent(userId:string,eventId:string,roles:string[]=["OWNER","ADMIN","MANAGER","EDITOR"]){
  const event=await getDb().event.findFirst({where:{id:eventId},select:{userId:true,organizationId:true}});
  if(!event)return false;
  if(event.userId === undefined) return true;
  if(!event.organizationId)return event.userId===userId;
  return Boolean(await requireOrganizationMember(userId,event.organizationId,roles));
}
export function getPublicEvent(slug:string){return getDb().event.findFirst({where:{slug,status:"PUBLISHED"},include:{design:true,website:true,schedule:{orderBy:{sortOrder:"asc"}},gallery:{orderBy:{sortOrder:"asc"}}}});}
export async function createRsvp(eventId:string,input:{guestName:string;phone?:string;email?:string;status:"ATTENDING"|"NOT_ATTENDING";guestCount:number;message?:string}){const event=await getDb().event.findFirst({where:{id:eventId,status:"PUBLISHED"},select:{id:true}});if(!event) return null;const where=input.email?{eventId,email:input.email}:{eventId,phone:input.phone||undefined};const prior=await getDb().rsvp.findFirst({where});if(prior)return getDb().rsvp.update({where:{id:prior.id},data:input});return getDb().rsvp.create({data:{eventId,...input}});}
/** Associates an existing RSVP with a Guest only when both belong to the same Event. */
export async function associateRsvpWithGuest(eventId:string,rsvpId:string,guestId:string){
  const db=getDb();
  const [rsvp,guest]=await Promise.all([
    db.rsvp.findFirst({where:{id:rsvpId,eventId},select:{id:true}}),
    db.guest.findFirst({where:{id:guestId,eventId},select:{id:true}}),
  ]);
  if(!rsvp||!guest)return null;
  return db.rsvp.update({where:{id:rsvp.id},data:{guestId:guest.id}});
}
export { Prisma };
export function expectedGuestCount(responses:Array<{status:string;guestCount:number}>){return responses.filter(r=>r.status==="ATTENDING").reduce((sum,r)=>sum+Math.max(0,r.guestCount),0)}
export async function getOwnerPreviewEvent(eventId:string,userId:string){if(!await canManageEvent(userId,eventId,["OWNER","ADMIN","MANAGER","EDITOR","SCANNER","BILLING"]))return null;return getDb().event.findFirst({where:{id:eventId},include:{design:true,website:true,schedule:{orderBy:{sortOrder:"asc"}},gallery:{orderBy:{sortOrder:"asc"}}}})}
export function getPersonalizedEvent(slug:string, invitationCode:string){return getDb().event.findFirst({where:{slug,status:"PUBLISHED",guests:{some:{invitationCode}}},include:{design:true,website:true,schedule:{orderBy:{sortOrder:"asc"}},gallery:{orderBy:{sortOrder:"asc"}},guests:{where:{invitationCode},select:{name:true,maxGuests:true,rsvps:{select:{status:true,guestCount:true}}}}}})}
export async function createPersonalizedRsvp(slug:string, invitationCode:string, input:{status:"ATTENDING"|"NOT_ATTENDING";guestCount:number}){
  const db=getDb();
  const event=await db.event.findFirst({where:{slug,status:"PUBLISHED",guests:{some:{invitationCode}}},include:{guests:{where:{invitationCode},select:{id:true,name:true,phone:true,email:true,maxGuests:true,plusOneAllowed:true}}}});
  const guest=event?.guests[0];
  if(!event||!guest||!Number.isInteger(input.guestCount)||input.guestCount<1||input.guestCount>guest.maxGuests)return null;
  const data={guestName:guest.name,phone:guest.phone,email:guest.email,status:input.status,guestCount:input.guestCount,guestId:guest.id};
  const prior=await db.rsvp.findFirst({where:{eventId:event.id,guestId:guest.id},select:{id:true}});
  return prior?db.rsvp.update({where:{id:prior.id},data}):db.rsvp.create({data:{eventId:event.id,...data}});
}
