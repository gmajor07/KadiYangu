import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BeemSmsProvider, MockSmsProvider, smsConfiguration, prepareBeemRequest, normalizeBeemResponse, normalizeBeemTimeout, mapBeemDeliveryStatus, submitBeemSms, normalizeBeemDeliveryReport, prepareBeemDeliveryRequest } from "@/services/beem-sms";
import { smsRetryDecision } from "@/services/sms-queue";

describe("Phase 7E.4 Beem preparation", () => {
  const fetcher=vi.fn(()=>{throw new Error("Unexpected network request");});
  beforeEach(()=>{
    vi.stubGlobal("fetch",fetcher); fetcher.mockClear();
    for(const name of ["BEEM_API_KEY","BEEM_API_SECRET","BEEM_SENDER_ID","BEEM_SENDER_APPROVED","SMS_DISPATCH_MODE","SMS_MOCK_DISPATCH_ENABLED"]) vi.stubEnv(name,"");
  });
  afterEach(()=>{expect(fetcher).not.toHaveBeenCalled();vi.unstubAllEnvs();vi.unstubAllGlobals();});
  function configure(){vi.stubEnv("BEEM_API_KEY","test-key");vi.stubEnv("BEEM_API_SECRET","test-secret");vi.stubEnv("BEEM_SENDER_ID","KADI");vi.stubEnv("BEEM_SENDER_APPROVED","true");}
  it("is disabled with missing credentials and rejects request preparation",()=>{
    expect(smsConfiguration()).toMatchObject({liveEnabled:false,providerReady:false,mockEnabled:false});
    expect(()=>prepareBeemRequest("255712345678","Hello")).toThrow();
  });
  it("requires an approved valid Sender ID",()=>{
    configure();vi.stubEnv("BEEM_SENDER_APPROVED","false");expect(smsConfiguration().providerReady).toBe(false);
    vi.stubEnv("BEEM_SENDER_APPROVED","true");vi.stubEnv("BEEM_SENDER_ID","");expect(smsConfiguration().providerReady).toBe(false);
    vi.stubEnv("BEEM_SENDER_ID","NAME_TOO_LONG");expect(smsConfiguration().providerReady).toBe(false);
  });
  it("cannot enable live I/O with credentials or live environment flags",async()=>{
    configure();vi.stubEnv("SMS_DISPATCH_MODE","live");vi.stubEnv("SMS_LIVE_ENABLED","true");
    expect(smsConfiguration()).toMatchObject({providerReady:true,liveEnabled:false,mockEnabled:false});
    expect(await new BeemSmsProvider().submit()).toMatchObject({outcome:"REJECTED",kind:"CONFIGURATION"});
    expect(await submitBeemSms("255712345678","Hello")).toMatchObject({outcome:"REJECTED"});
  });
  it("requires two explicit mock flags",()=>{
    vi.stubEnv("SMS_DISPATCH_MODE","mock");expect(smsConfiguration().mockEnabled).toBe(false);
    vi.stubEnv("SMS_MOCK_DISPATCH_ENABLED","true");expect(smsConfiguration().mockEnabled).toBe(true);
  });
  it("prepares the verified Beem contract without executing it",()=>{
    configure();const request=prepareBeemRequest("255712345678","Hello Asha");
    expect(request.url).toBe("https://apisms.beem.africa/v1/send");
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("test-key:test-secret").toString("base64")}`);
    expect(request.body).toEqual({source_addr:"KADI",encoding:0,schedule_time:"",message:"Hello Asha",recipients:[{recipient_id:1,dest_addr:"255712345678"}]});
  });
  it("normalizes acceptance without claiming delivery",()=>{
    expect(normalizeBeemResponse(200,{successful:true,code:100,valid:1,request_id:123})).toEqual({outcome:"ACCEPTED",requestId:"123"});
    expect(normalizeBeemResponse(200,{successful:true,code:100,valid:0})).toMatchObject({kind:"PERMANENT"});
  });
  it("classifies permanent and configuration failures without exposing raw response data",()=>{
    expect(normalizeBeemResponse(400,{code:101,message:"private"})).toMatchObject({kind:"PERMANENT"});
    for(const code of [102,111,120,121]) expect(normalizeBeemResponse(400,{code})).toMatchObject({kind:"CONFIGURATION"});
    expect(JSON.stringify(normalizeBeemResponse(401,{code:120,message:"private"}))).not.toContain("private");
  });
  it("quarantines ambiguous timeout/5xx and only retries explicit transient rejection",()=>{
    expect(normalizeBeemTimeout()).toMatchObject({kind:"UNCERTAIN"});
    expect(normalizeBeemResponse(503,{code:103})).toMatchObject({kind:"UNCERTAIN"});
    expect(normalizeBeemResponse(429,{successful:false})).toMatchObject({kind:"TRANSIENT"});
    expect(normalizeBeemResponse(429,{})).toMatchObject({kind:"UNCERTAIN"});
  });
  it("maps only documented delivery values",()=>{
    expect(mapBeemDeliveryStatus("DELIVERED")).toBe("DELIVERED");expect(mapBeemDeliveryStatus("UNDELIVERED")).toBe("FAILED");expect(mapBeemDeliveryStatus("PENDING")).toBe("SENT");expect(mapBeemDeliveryStatus("SUCCESS")).toBeNull();
  });
  it("correlates delivery reports and enforces Beem's five-minute delay without polling",()=>{
    configure();const expected={requestId:"123",destination:"255712345678"};
    expect(normalizeBeemDeliveryReport([{request_id:"other",dest_addr:expected.destination,status:"DELIVERED"}],expected)).toBeNull();
    expect(normalizeBeemDeliveryReport([{request_id:123,dest_addr:expected.destination,status:"DELIVERED"}],expected)).toEqual({...expected,status:"DELIVERED"});
    const submittedAt=new Date("2026-10-26T10:00:00Z");
    expect(()=>prepareBeemDeliveryRequest({...expected,submittedAt},new Date("2026-10-26T10:04:00Z"))).toThrow();
    expect(prepareBeemDeliveryRequest({...expected,submittedAt},new Date("2026-10-26T10:05:00Z")).url).toContain("https://dlrapi.beem.africa/public/v1/delivery-reports?");
  });
  it("supports deterministic mock results and idempotent acceptance",async()=>{
    const provider=new MockSmsProvider();const input={destination:"255712345678",message:"Hello",idempotencyKey:"job-a"};
    expect(await provider.submit(input)).toEqual(await provider.submit(input));
  });
  it("bounds retries and does not retry permanent, configuration or uncertain failures",()=>{
    const now=new Date("2026-10-26T10:00:00Z");const transient={outcome:"REJECTED" as const,kind:"TRANSIENT" as const,reason:"rate limited"};
    expect(smsRetryDecision(transient,1,now)).toEqual({state:"RETRY_WAIT",next:new Date("2026-10-26T10:01:00Z")});
    expect(smsRetryDecision(transient,2,now).next).toEqual(new Date("2026-10-26T10:02:00Z"));
    expect(smsRetryDecision(transient,3,now)).toEqual({state:"FAILED",next:null});
    for(const kind of ["PERMANENT","CONFIGURATION","UNCERTAIN"] as const) expect(smsRetryDecision({...transient,kind},1,now).next).toBeNull();
  });
});
