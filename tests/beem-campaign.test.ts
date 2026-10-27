import { Prisma } from "@prisma/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({ db:{messageCampaign:{findFirst:vi.fn()},guest:{findMany:vi.fn()},eventContributor:{findMany:vi.fn()},messageConsent:{findMany:vi.fn()},messageRecipient:{findMany:vi.fn(),findUniqueOrThrow:vi.fn(),updateMany:vi.fn(),update:vi.fn()},messageLog:{create:vi.fn()},auditLog:{create:vi.fn()},$transaction:vi.fn()},allowed:vi.fn() }));
vi.mock("@/lib/db",()=>({getDb:()=>mocks.db}));
vi.mock("@/services/events",()=>({canManageEvent:mocks.allowed}));
import {sendSmsCampaign} from "@/services/messaging";
import {prepareSmsQueue,processMockSmsJob,smsQueueOverview} from "@/services/sms-queue";
import {MockSmsProvider} from "@/services/beem-sms";
const now=new Date("2026-10-26T10:00:00Z");
const recipient={id:"recipient",campaignId:"campaign",guestId:"guest",contributorId:null,destination:"255712345678",renderedBody:"Hello",smsIdempotencyKey:"mock:recipient",smsAttempts:1};
describe("Phase 7E.4 queue and dispatch",()=>{
 beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv("SMS_DISPATCH_MODE","mock");vi.stubEnv("SMS_MOCK_DISPATCH_ENABLED","true");vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("Live network forbidden");}));
  mocks.db.$transaction.mockImplementation(async callback=>callback(mocks.db));mocks.allowed.mockResolvedValue(true);
  mocks.db.messageCampaign.findFirst.mockResolvedValue({id:"campaign"});
  mocks.db.guest.findMany.mockResolvedValue([{id:"guest",phone:"0712345678",email:null}]);
  mocks.db.eventContributor.findMany.mockResolvedValue([]);
  mocks.db.messageConsent.findMany.mockResolvedValue([{guestId:"guest",contributorId:null,status:"OPTED_IN"}]);
  mocks.db.messageRecipient.findMany.mockResolvedValue([recipient]);mocks.db.messageRecipient.findUniqueOrThrow.mockResolvedValue(recipient);
  mocks.db.messageRecipient.updateMany.mockResolvedValue({count:1});
 });
 afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it("rejects unauthorized preparation and worker access",async()=>{
  mocks.allowed.mockResolvedValue(false);expect((await prepareSmsQueue("user","event","campaign")).ok).toBe(false);expect((await processMockSmsJob("user","event","recipient")).ok).toBe(false);expect(mocks.db.$transaction).not.toHaveBeenCalled();
 });
 it("keeps the legacy live entry point disabled",async()=>{
  expect(await sendSmsCampaign("user","event","campaign")).toMatchObject({ok:false,error:expect.stringContaining("disabled")});expect(mocks.db.$transaction).not.toHaveBeenCalled();
 });
 it("does not execute a worker by default",async()=>{
  vi.stubEnv("SMS_DISPATCH_MODE","");expect((await processMockSmsJob("user","event","recipient")).ok).toBe(false);expect(mocks.db.$transaction).not.toHaveBeenCalled();
 });
 it("only prepares READY SMS campaigns",async()=>{
  mocks.db.messageCampaign.findFirst.mockResolvedValue(null);expect((await prepareSmsQueue("user","event","campaign")).ok).toBe(false);
  expect(mocks.db.messageCampaign.findFirst).toHaveBeenCalledWith({where:{id:"campaign",eventId:"event",status:"READY",channel:"SMS"}});expect(mocks.db.messageRecipient.updateMany).not.toHaveBeenCalled();
 });
 it("creates idempotent mock jobs with logs and audit",async()=>{
  expect((await prepareSmsQueue("user","event","campaign")).ok).toBe(true);
  expect(mocks.db.messageRecipient.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({smsJobState:"NONE",status:"NOT_SENT"}),data:expect.objectContaining({smsJobState:"PENDING",smsMode:"MOCK",smsIdempotencyKey:"mock:recipient"})}));
  expect(mocks.db.auditLog.create).toHaveBeenCalled();expect(mocks.db.messageLog.create).toHaveBeenCalled();
 });
 it("does not queue unknown or opted-out consent",async()=>{
  for(const status of ["UNKNOWN","OPTED_OUT"]){mocks.db.messageConsent.findMany.mockResolvedValue([{guestId:"guest",contributorId:null,status}]);await prepareSmsQueue("user","event","campaign");}expect(mocks.db.messageRecipient.updateMany).not.toHaveBeenCalled();
 });
 it("records simulated acceptance without real SENT status",async()=>{
  expect(await processMockSmsJob("user","event","recipient")).toMatchObject({ok:true,state:"COMPLETE"});
  expect(mocks.db.messageRecipient.update).toHaveBeenCalledWith({where:{id:"recipient"},data:expect.objectContaining({status:"QUEUED",smsJobState:"COMPLETE",smsProviderRequestId:"mock:mock:recipient"})});
 });
 it("prevents duplicate or non-READY dispatch with an atomic claim",async()=>{
  mocks.db.messageRecipient.updateMany.mockResolvedValue({count:0});const provider=new MockSmsProvider();const submit=vi.spyOn(provider,"submit");
  expect((await processMockSmsJob("user","event","recipient",provider,now)).ok).toBe(false);expect(submit).not.toHaveBeenCalled();
  expect(mocks.db.messageRecipient.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({smsJobState:{in:["PENDING","RETRY_WAIT"]},smsNextAttemptAt:{lte:now},campaign:{eventId:"event",status:"READY",channel:"SMS"}})}));
 });
 it("revalidates consent after claim",async()=>{
  mocks.db.messageConsent.findMany.mockResolvedValue([]);const provider=new MockSmsProvider();const submit=vi.spyOn(provider,"submit");
  expect(await processMockSmsJob("user","event","recipient",provider)).toMatchObject({state:"FAILED"});expect(submit).not.toHaveBeenCalled();
 });
 it("schedules transient retries and records permanent failures",async()=>{
  const transient=new MockSmsProvider([{outcome:"REJECTED",kind:"TRANSIENT",reason:"Mock rate limit"}]);
  expect(await processMockSmsJob("user","event","recipient",transient,now)).toMatchObject({state:"RETRY_WAIT"});
  expect(mocks.db.messageRecipient.update).toHaveBeenCalledWith({where:{id:"recipient"},data:expect.objectContaining({smsNextAttemptAt:new Date(now.getTime()+60000),smsErrorKind:"TRANSIENT"})});
  const permanent=new MockSmsProvider([{outcome:"REJECTED",kind:"PERMANENT",reason:"Invalid destination"}]);expect(await processMockSmsJob("user","event","recipient",permanent)).toMatchObject({state:"FAILED"});
 });
 it("reports an unapplied queue migration without crashing the dashboard",async()=>{
  const missing=new Prisma.PrismaClientKnownRequestError("column missing",{code:"P2022",clientVersion:"6.19.3"});
  mocks.db.messageRecipient.findMany.mockRejectedValue(missing);
  expect(await smsQueueOverview("user","event")).toEqual({migrationRequired:true,jobs:[]});
  expect(await prepareSmsQueue("user","event","campaign")).toMatchObject({ok:false,error:expect.stringContaining("migration")});
 });
 it("quarantines timeouts rather than retrying",async()=>{
  const provider=new MockSmsProvider();vi.spyOn(provider,"submit").mockRejectedValue(new Error("timeout"));expect(await processMockSmsJob("user","event","recipient",provider)).toMatchObject({state:"UNCERTAIN"});
 });
});
