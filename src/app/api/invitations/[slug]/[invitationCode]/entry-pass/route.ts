import {personalizedEntryToken} from "@/services/guest-entry-passes";
import {entryPassPng,privatePassHeaders} from "@/lib/entry-pass-response";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{slug:string;invitationCode:string}>}){
 try{
  const {slug,invitationCode}=await params;
  const slot=Number(new URL(req.url).searchParams.get("slot") || "1");
  if(!Number.isInteger(slot)||slot<1||slot>10000)return await entryPassPng(null);
  return await entryPassPng(await personalizedEntryToken(slug,invitationCode,slot));
 }catch{return Response.json({error:"Entry pass temporarily unavailable. Contact the organizer."},{status:503,headers:privatePassHeaders});}
}
