import "server-only";

// Phase 7E.4 is PREPARED. Changing environment variables cannot unlock live I/O.
export const LIVE_SMS_IMPLEMENTED = false;
export type SmsErrorKind = "CONFIGURATION" | "PERMANENT" | "TRANSIENT" | "UNCERTAIN";
export type SmsResult =
  | { outcome: "ACCEPTED"; requestId: string }
  | { outcome: "REJECTED"; kind: SmsErrorKind; reason: string };
export interface SmsProvider {
  readonly mode: "MOCK" | "BEEM";
  submit(input: { destination: string; message: string; idempotencyKey: string }): Promise<SmsResult>;
}
const validSecret = (value: string | undefined) => !!value?.trim() && !/[\r\n:]/.test(value) && !/REPLACE|YOUR_|<|\.\.\./i.test(value);
export function smsConfiguration() {
  const credentialsPresent = validSecret(process.env.BEEM_API_KEY) && validSecret(process.env.BEEM_API_SECRET);
  const senderPresent = /^[a-zA-Z0-9 ]{1,11}$/.test(process.env.BEEM_SENDER_ID || "") && /[a-zA-Z0-9]/.test(process.env.BEEM_SENDER_ID || "");
  const senderApproved = senderPresent && process.env.BEEM_SENDER_APPROVED === "true";
  return {
    phase: "PREPARED" as const, liveEnabled: false as const,
    credentialsPresent, senderPresent, senderApproved,
    providerReady: credentialsPresent && senderApproved,
    mockEnabled: process.env.SMS_DISPATCH_MODE === "mock" && process.env.SMS_MOCK_DISPATCH_ENABLED === "true",
  };
}
export function beemConfigured() { return smsConfiguration().providerReady; }

// Pure request preparation only. No fetch, socket, SDK, timer or live transport.
// Contract: https://docs.beem.africa/api-reference/send-sms
export function prepareBeemRequest(destination: string, message: string) {
  if (!beemConfigured()) throw new Error("Beem credentials and approved Sender ID are required.");
  if (!/^255[67]\d{8}$/.test(destination) || !message.trim() || message.length > 5000) throw new Error("Invalid SMS recipient or message.");
  return {
    url: "https://apisms.beem.africa/v1/send",
    method: "POST" as const,
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.BEEM_API_KEY}:${process.env.BEEM_API_SECRET}`).toString("base64")}`, "Content-Type": "application/json" },
    body: { source_addr: process.env.BEEM_SENDER_ID, encoding: 0, schedule_time: "", message, recipients: [{ recipient_id: 1, dest_addr: destination }] },
    timeoutMs: 15000,
  };
}
export function normalizeBeemResponse(httpStatus: number, value: unknown): SmsResult {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (httpStatus >= 200 && httpStatus < 300 && body.successful === true && body.code === 100 && body.valid === 1 &&
      (typeof body.request_id === "string" || typeof body.request_id === "number") && String(body.request_id).length > 0 && String(body.request_id).length <= 100) {
    return { outcome: "ACCEPTED", requestId: String(body.request_id) };
  }
  // A timeout/5xx/103 can occur AFTER submission: retry would risk duplicate SMS.
  if (httpStatus >= 500 || body.code === 103) return { outcome: "REJECTED", kind: "UNCERTAIN", reason: "Provider submission uncertain; reconcile before retry." };
  if (httpStatus === 429 && body.successful === false) return { outcome: "REJECTED", kind: "TRANSIENT", reason: "Provider explicitly rejected submission due to rate limiting." };
  if (body.code === 102 || body.code === 111 || body.code === 120 || body.code === 121 || httpStatus === 401) return { outcome: "REJECTED", kind: "CONFIGURATION", reason: "Check Beem balance, credentials and approved Sender ID." };
  if ([101,104,109,110,112,113,114,115,116,117,118,119,122,123].includes(Number(body.code)) || body.valid === 0) return { outcome: "REJECTED", kind: "PERMANENT", reason: "Provider rejected the SMS parameters or recipient." };
  return { outcome: "REJECTED", kind: "UNCERTAIN", reason: "Unrecognized provider response; reconcile before retry." };
}
export function normalizeBeemTimeout(): SmsResult {
  return { outcome: "REJECTED", kind: "UNCERTAIN", reason: "Submission timed out; reconcile before retry." };
}
// These are Beem's documented DLR values; unknown values must not imply success.
export function mapBeemDeliveryStatus(value: unknown) {
  if (value === "DELIVERED") return "DELIVERED" as const;
  if (value === "UNDELIVERED") return "FAILED" as const;
  if (value === "PENDING") return "SENT" as const;
  return null;
}
export class MockSmsProvider implements SmsProvider {
  readonly mode = "MOCK" as const;
  private accepted = new Map<string, SmsResult>();
  constructor(private readonly results: SmsResult[] = []) {}
  async submit(input: { destination: string; message: string; idempotencyKey: string }): Promise<SmsResult> {
    const prior = this.accepted.get(input.idempotencyKey);
    if (prior) return prior;
    const result = this.results.shift() || { outcome: "ACCEPTED" as const, requestId: `mock:${input.idempotencyKey}`.slice(0,100) };
    if (result.outcome === "ACCEPTED") this.accepted.set(input.idempotencyKey, result);
    return result;
  }
}
export class BeemSmsProvider implements SmsProvider {
  readonly mode = "BEEM" as const;
  async submit(): Promise<SmsResult> {
    return { outcome: "REJECTED", kind: "CONFIGURATION", reason: "SMS dispatch disabled: Phase 7E.4 PREPARED; live adapter locked." };
  }
}
// Compatibility entry point: old callers cannot bypass the preparation lock.
export async function submitBeemSms(_destination: string, _message: string) {
  void _destination; void _message;
  return new BeemSmsProvider().submit();
}

export type SmsDeliveryReport = { requestId: string; destination: string; status: "SENT" | "DELIVERED" | "FAILED" };
// Pure correlation prevents another recipient's delivery report changing this job.
export function normalizeBeemDeliveryReport(value: unknown, expected: {requestId: string; destination: string}): SmsDeliveryReport | null {
  if (!Array.isArray(value)) return null;
  for (const row of value) {
    if (!row || typeof row !== "object" || String(row.request_id) !== expected.requestId || row.dest_addr !== expected.destination) continue;
    const status = mapBeemDeliveryStatus(row.status);
    if (status) return {...expected,status};
  }
  return null;
}
export function prepareBeemDeliveryRequest(input: {requestId: string; destination: string; submittedAt: Date}, now = new Date()) {
  if (!beemConfigured()) throw new Error("Beem credentials and approved Sender ID are required.");
  if (!/^255[67]\d{8}$/.test(input.destination) || !input.requestId || input.requestId.length > 100 ||
      !Number.isFinite(input.submittedAt.getTime()) || now.getTime() - input.submittedAt.getTime() < 300000) throw new Error("Delivery lookup requires valid identifiers and a submission at least five minutes old.");
  const query = new URLSearchParams({dest_addr:input.destination,request_id:input.requestId});
  return {url:`https://dlrapi.beem.africa/public/v1/delivery-reports?${query}`,method:"GET" as const,headers:{Authorization:`Basic ${Buffer.from(`${process.env.BEEM_API_KEY}:${process.env.BEEM_API_SECRET}`).toString("base64")}`,"Content-Type":"application/json"},timeoutMs:15000};
}
