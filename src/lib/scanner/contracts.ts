// Existing entry passes are 32 cryptographically random bytes, base64url encoded.
// Invitation URLs/codes are deliberately never converted into entry credentials.
export const isEntryPassToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function parseEntryQr(value: string): {ok:true;token:string} | {ok:false;reason:"INVITATION_QR"|"INVALID"} {
  const text = value.trim();
  if (/^https?:\/\//i.test(text) || text.startsWith("/i/")) return {ok:false,reason:"INVITATION_QR"};
  return isEntryPassToken(text) ? {ok:true,token:text} : {ok:false,reason:"INVALID"};
}
export type EntryDetails = {guestName:string|null;allowedEntries:1;checkedIn:1;remaining:0};
export type ScanResult = {ok:true;entry:EntryDetails} | {ok:false;reason:string;entry?:EntryDetails};
export function scanFeedback(result: ScanResult) {
  if (result.ok) return {title:"Entry approved",message:"Check-in recorded. Admit one person.",tone:"success" as const};
  const messages:Record<string,[string,string]> = {
    ALREADY_USED:["Already checked in","This pass has already been used. No additional entry was recorded."],
    WRONG_EVENT:["Wrong event","This entry pass belongs to another event. No check-in was recorded."],
    INVITATION_QR:["Invitation QR, not an entry pass","This is an invitation link, not an entry pass. Ask the guest to open their invitation and select My Entry Pass."],
    INVALID:["Invalid entry QR","Use a valid entry-pass QR. No check-in was recorded."],
    NOT_ELIGIBLE:["Entry not available","The guest’s RSVP or entry entitlement no longer allows this pass. Ask the organizer for help."],
    REVOKED:["Pass revoked","This entry pass has been revoked. No check-in was recorded."],
    UNAUTHORIZED:["Access denied","You no longer have permission to check in guests for this event."],
    UNAVAILABLE:["Verification unavailable","Check your connection. Entry is not approved. A timed-out request may have completed; rescan to confirm its status."],
  };
  const [title,message] = messages[result.reason] || messages.UNAVAILABLE;
  return {title,message,tone:"error" as const};
}

// A synchronous lock prevents two decoder callbacks posting before React renders.
export class ScanGate {
  private busy = false;
  private recent = new Map<string,number>();
  constructor(private readonly cooldown = 5000) {}
  claim(value: string, now = Date.now()) {
    if (this.busy || (this.recent.get(value) ?? -Infinity) + this.cooldown > now) return false;
    for (const [key,time] of this.recent) if (time + this.cooldown <= now) this.recent.delete(key);
    this.busy = true; this.recent.set(value,now); return true;
  }
  release() { this.busy=false; }
}
