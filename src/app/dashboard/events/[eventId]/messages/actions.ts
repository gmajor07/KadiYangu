"use server";
import { requireUser } from "@/lib/auth/guards";
import { createMessageCampaign, saveMessageTemplate, transitionCampaign, saveCampaignRecipients, setMessageConsent } from "@/services/messaging";
import { redirect } from "next/navigation";
export async function messageAction(form: FormData): Promise<{ok:boolean;error?:string;success?:string}> {
  const user=await requireUser(); const eventId=String(form.get("eventId")); const action=String(form.get("action"));
  if(action==="template") return (await saveMessageTemplate(user.id,eventId,{name:String(form.get("name")),channel:String(form.get("channel")) as never,body:String(form.get("body"))})) ? {ok:true,success:"Template saved"}:{ok:false,error:"Unable to save template"};
  if(action==="campaign") return (await createMessageCampaign(user.id,eventId,{name:String(form.get("name")),channel:String(form.get("channel")) as never,templateId:String(form.get("templateId")||"")||undefined})) ? {ok:true,success:"Campaign draft created"}:{ok:false,error:"Unable to create campaign"};
  if(action==="recipients") { let ids:string[]|undefined; const raw=form.get("recipientIds"); const scope=String(form.get("selectionScope")||"INDIVIDUAL"); if(scope!=="ALL_ELIGIBLE"&&raw){try{const parsed=JSON.parse(String(raw));if(Array.isArray(parsed))ids=parsed.map(String);}catch{}} const result=await saveCampaignRecipients(user.id,eventId,String(form.get("campaignId")),String(form.get("audience")) as never,{event_name:String(form.get("eventName")||"Event")},ids); return result?.eligible.length ? {ok:true,success:`Saved ${result.eligible.length} recipients`}:{ok:false,error:"No eligible recipients selected"}; }
  if(action==="consent") return (await setMessageConsent(user.id,eventId,{guestId:String(form.get("guestId")||"")||undefined,contributorId:String(form.get("contributorId")||"")||undefined,channel:String(form.get("channel")) as never,status:String(form.get("status")) as never,source:String(form.get("source")||"organizer_dashboard")})) ? {ok:true,success:"Consent updated"}:{ok:false,error:"Consent update rejected"};
  if(action==="transition") return (await transitionCampaign(user.id,eventId,String(form.get("campaignId")),String(form.get("status")) as "READY"|"CANCELLED")) ? {ok:true,success:"Campaign updated"}:{ok:false,error:"Campaign transition rejected"};
  return {ok:false,error:"Invalid messaging action"};
}
export async function messageActionState(_previous:{ok:boolean;error?:string;success?:string}, form:FormData){ return messageAction(form); }
