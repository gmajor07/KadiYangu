import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {entryTokenHash,openEntryToken,passRetrievalConfigured,sealEntryToken} from "@/lib/entry-pass-crypto";
import {guestEntryLimit} from "@/lib/guest-entry-policy";
const binding={id:"pass",eventId:"event",replacementRevision:1},token="A".repeat(43);
describe("stable encrypted entry-pass storage",()=>{
 beforeEach(()=>{vi.stubEnv("AUTH_SECRET","test-only-secret-with-at-least-thirty-two-characters");vi.stubEnv("ENTRY_PASS_ENCRYPTION_KEY","");});
 afterEach(()=>vi.unstubAllEnvs());
 it("reopens the same existing token without storing plaintext",()=>{
  const envelope=sealEntryToken(token,binding);expect(envelope).not.toContain(token);expect(openEntryToken(envelope,binding,entryTokenHash(token))).toBe(token);expect(openEntryToken(envelope,binding,entryTokenHash(token))).toBe(token);
 });
 it("rejects ciphertext swapped across passes, events, revisions and hashes",()=>{
  const envelope=sealEntryToken(token,binding),hash=entryTokenHash(token);
  for(const changed of [{...binding,id:"other"},{...binding,eventId:"other"},{...binding,replacementRevision:2}])expect(openEntryToken(envelope,changed,hash)).toBeNull();
  expect(openEntryToken(envelope,binding,"bad-hash")).toBeNull();expect(openEntryToken("invalid",binding,hash)).toBeNull();
 });
 it("fails closed with a missing or rotated key",()=>{
  const envelope=sealEntryToken(token,binding);vi.stubEnv("AUTH_SECRET","different-test-secret-with-more-than-32-characters");expect(openEntryToken(envelope,binding,entryTokenHash(token))).toBeNull();vi.stubEnv("AUTH_SECRET","");expect(passRetrievalConfigured()).toBe(false);expect(()=>sealEntryToken(token,binding)).toThrow();
 });
});
describe("RSVP is a limit, not pass entitlement",()=>{
 it("requires attending and honors guest and plus-one limits",()=>{
  const guest={maxGuests:3,plusOneAllowed:true,rsvps:[{status:"ATTENDING",guestCount:2}]};
  expect(guestEntryLimit(guest)).toBe(2);expect(guestEntryLimit({...guest,plusOneAllowed:false})).toBe(1);expect(guestEntryLimit({...guest,maxGuests:1})).toBe(1);expect(guestEntryLimit({...guest,rsvps:[]})).toBe(0);expect(guestEntryLimit({...guest,rsvps:[{status:"NOT_ATTENDING",guestCount:2}]})).toBe(0);
 });
});
