import "server-only";
import { getDb } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { canManageEvent } from "@/services/events";
function code(){return randomBytes(18).toString("base64url")}
export const validateGuestInput = input;
function input(data:Record<string,unknown>){const name=String(data.name||"").trim();if(!name||name.length>160)return null;const email=data.email?String(data.email).trim():null;if(email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return null;const max=Number(data.maxGuests??1);if(!Number.isInteger(max)||max<1||max>10000)return null;return {name,phone:data.phone?String(data.phone).slice(0,40):null,email:email?email.slice(0,254):null,category:data.category?String(data.category).trim().slice(0,80):null,notes:data.notes?String(data.notes).slice(0,500):null,maxGuests:max,plusOneAllowed:Boolean(data.plusOneAllowed)}}
export async function listGuests(userId:string,eventId:string,q=""){if(!await canManageEvent(userId,eventId,["OWNER","ADMIN","MANAGER","EDITOR"]))return null;return getDb().guest.findMany({where:{eventId,OR:q?[{name:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}},{phone:{contains:q}},{category:{contains:q,mode:"insensitive"}}]:undefined},orderBy:{name:"asc"}})}
export async function createGuest(userId:string,eventId:string,data:Record<string,unknown>){if(!await canManageEvent(userId,eventId,["OWNER","ADMIN","MANAGER","EDITOR"]))return null;const value=input(data);if(!value)return null;return getDb().guest.create({data:{eventId,invitationCode:code(),...value}})}
export async function updateGuest(userId:string,eventId:string,id:string,data:Record<string,unknown>){if(!await canManageEvent(userId,eventId,["OWNER","ADMIN","MANAGER","EDITOR"]))return null;const value=input(data);if(!value)return null;return getDb().guest.updateMany({where:{id,eventId},data:value})}
export async function deleteGuest(userId:string,eventId:string,id:string){if(!await canManageEvent(userId,eventId,["OWNER","ADMIN","MANAGER","EDITOR"]))return false;return (await getDb().guest.deleteMany({where:{id,eventId}})).count>0}
export function guestCapacity(guests:Array<{maxGuests:number}>){return guests.reduce((n,g)=>n+g.maxGuests,0)}
