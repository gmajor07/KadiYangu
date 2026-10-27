import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { canManageEvent } from "@/services/events";
import { loadMessagingEligibility, recipientIdentity } from "@/services/messaging-eligibility";
import { MockSmsProvider, smsConfiguration, type SmsResult } from "@/services/beem-sms";

const roles = ["OWNER","ADMIN","MANAGER","EDITOR"];
export const MAX_SMS_ATTEMPTS = 3;
export function smsRetryDecision(result: SmsResult, attempt: number, now: Date) {
  if (result.outcome === "ACCEPTED") return { state: "COMPLETE" as const, next: null };
  if (result.kind === "UNCERTAIN") return { state: "UNCERTAIN" as const, next: null };
  if (result.kind === "TRANSIENT" && attempt < MAX_SMS_ATTEMPTS) return { state: "RETRY_WAIT" as const, next: new Date(now.getTime() + 60_000 * 2 ** (attempt - 1)) };
  return { state: "FAILED" as const, next: null };
}
export function smsSchemaMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ["P2021","P2022"].includes(error.code);
}

export async function prepareSmsQueue(userId: string, eventId: string, campaignId: string) {
  if (!await canManageEvent(userId,eventId,roles)) return {ok:false,error:"Campaign not found."};
  try {
    const queued = await getDb().$transaction(async tx => {
      const campaign = await tx.messageCampaign.findFirst({where:{id:campaignId,eventId,status:"READY",channel:"SMS"}});
      if (!campaign) return null;
      const eligibility = await loadMessagingEligibility(eventId,"SMS",tx);
      const eligible = new Set(eligibility.eligible.map(recipientIdentity));
      const recipients = await tx.messageRecipient.findMany({where:{campaignId,status:"NOT_SENT",smsJobState:"NONE"},orderBy:{id:"asc"},take:100});
      let count = 0;
      for (const recipient of recipients) {
        if (!eligible.has(recipientIdentity(recipient))) continue;
        const changed = await tx.messageRecipient.updateMany({where:{id:recipient.id,status:"NOT_SENT",smsJobState:"NONE",campaign:{status:"READY"}},data:{smsJobState:"PENDING",smsMode:"MOCK",smsIdempotencyKey:`mock:${recipient.id}`,smsNextAttemptAt:new Date(),status:"QUEUED"}});
        if (!changed.count) continue;
        count++;
        await tx.messageLog.create({data:{eventId,campaignId,recipientId:recipient.id,channel:"SMS",status:"QUEUED"}});
      }
      await tx.auditLog.create({data:{actorUserId:userId,action:"SMS_MOCK_QUEUE_PREPARED",entityType:"MessageCampaign",entityId:campaignId,afterData:{queued:count,mode:"MOCK",liveEnabled:false}}});
      return count;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return queued === null ? {ok:false,error:"Only READY SMS campaigns can be queued."} : {ok:true,success:`Prepared ${queued} mock SMS jobs. Live dispatch remains disabled.`};
  } catch (error) {
    if (smsSchemaMissing(error)) return {ok:false,error:"Queue migration awaits review and application. SMS dispatch disabled."};
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034","P2002"].includes(error.code)) return {ok:false,error:"Queue changed concurrently. Refresh and prepare again safely."};
    throw error;
  }
}

// Server-only mock worker, deliberately not connected to a cron, route or live-send UI.
// No DB-backed worker runs unless mock execution is explicitly selected and enabled.
export async function processMockSmsJob(userId: string, eventId: string, recipientId: string, provider = new MockSmsProvider(), now = new Date()) {
  if (!smsConfiguration().mockEnabled) return {ok:false,error:"Mock dispatch disabled. Live SMS dispatch remains disabled."};
  if (!(provider instanceof MockSmsProvider) || provider.mode !== "MOCK") return {ok:false,error:"Only the mock provider is permitted."};
  if (!await canManageEvent(userId,eventId,roles)) return {ok:false,error:"Event access denied."};
  try {
    return await getDb().$transaction(async tx => {
      const claim = await tx.messageRecipient.updateMany({where:{id:recipientId,smsMode:"MOCK",smsJobState:{in:["PENDING","RETRY_WAIT"]},smsAttempts:{lt:MAX_SMS_ATTEMPTS},smsNextAttemptAt:{lte:now},campaign:{eventId,status:"READY",channel:"SMS"}},data:{smsJobState:"PROCESSING",smsLockedAt:now,smsAttempts:{increment:1}}});
      if (!claim.count) return {ok:false,error:"Job is not due, already claimed, completed, or campaign is not READY."};
      const recipient = await tx.messageRecipient.findUniqueOrThrow({where:{id:recipientId}});
      const eligibility = await loadMessagingEligibility(eventId,"SMS",tx);
      const permitted = eligibility.eligible.some(r=>recipientIdentity(r) === recipientIdentity(recipient));
      let result: SmsResult;
      if (!permitted) result = {outcome:"REJECTED",kind:"PERMANENT",reason:"Recipient consent, contact or event eligibility changed."};
      else if (!recipient.smsIdempotencyKey || !recipient.renderedBody.trim()) result = {outcome:"REJECTED",kind:"PERMANENT",reason:"Missing job identity or message."};
      else {
        try { result = await provider.submit({destination:recipient.destination,message:recipient.renderedBody,idempotencyKey:recipient.smsIdempotencyKey}); }
        catch { result = {outcome:"REJECTED",kind:"UNCERTAIN",reason:"Mock submission uncertain; automatic retry blocked."}; }
      }
      const decision = smsRetryDecision(result,recipient.smsAttempts,now);
      const failure = result.outcome === "REJECTED" ? result : null;
      // Mock acceptance never claims real SENT/DELIVERED status.
      const status = decision.state === "FAILED" ? "FAILED" : "QUEUED";
      await tx.messageRecipient.update({where:{id:recipientId},data:{smsJobState:decision.state,smsNextAttemptAt:decision.next,smsLockedAt:null,smsErrorKind:failure?.kind || null,smsFailureReason:failure?.reason || null,smsProviderRequestId:result.outcome === "ACCEPTED" ? result.requestId : null,status}});
      await tx.messageLog.create({data:{eventId,campaignId:recipient.campaignId,recipientId,channel:"SMS",status,errorMessage:failure?.reason,providerRequestId:result.outcome === "ACCEPTED" ? result.requestId : undefined}});
      await tx.auditLog.create({data:{actorUserId:userId,action:`SMS_MOCK_${decision.state}`,entityType:"MessageRecipient",entityId:recipientId,afterData:{attempt:recipient.smsAttempts,state:decision.state,mode:"MOCK"}}});
      return {ok:true,state:decision.state};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return {ok:false,error:"Concurrent job change; retry mock worker later."};
    throw error;
  }
}

export async function smsQueueOverview(userId: string, eventId: string) {
  if (!await canManageEvent(userId,eventId,roles)) return null;
  try {
    const jobs = await getDb().messageRecipient.findMany({where:{campaign:{eventId,channel:"SMS"}},select:{id:true,campaignId:true,status:true,smsJobState:true,smsMode:true,smsAttempts:true,smsNextAttemptAt:true,smsFailureReason:true,smsErrorKind:true,smsProviderRequestId:true,smsDeliveryCheckedAt:true}});
    return {migrationRequired:false,jobs};
  } catch (error) {
    if (smsSchemaMissing(error)) return {migrationRequired:true,jobs:[]};
    throw error;
  }
}
