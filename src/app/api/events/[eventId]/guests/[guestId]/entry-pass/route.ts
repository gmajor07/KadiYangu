import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth/options";
import {getDb} from "@/lib/db";
import {organizerEntryToken} from "@/services/guest-entry-passes";
import {entryPassPng,privatePassHeaders} from "@/lib/entry-pass-response";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{eventId:string;guestId:string}>}){
 try{
  const session=await getServerSession(authOptions);
  if(!session?.user.id)return Response.json({error:"Unauthorized"},{status:401,headers:privatePassHeaders});
  const user=await getDb().user.findUnique({where:{id:session.user.id},select:{status:true}});
  if(user?.status!=="ACTIVE")return Response.json({error:"Unauthorized"},{status:403,headers:privatePassHeaders});
  const {eventId,guestId}=await params;
  const slot=Number(new URL(req.url).searchParams.get("slot") || "1");
  return await entryPassPng(await organizerEntryToken(session.user.id,eventId,guestId,slot));
 }catch{return Response.json({error:"Entry pass unavailable"},{status:503,headers:privatePassHeaders});}
}
