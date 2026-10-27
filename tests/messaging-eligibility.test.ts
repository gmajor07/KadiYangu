import {describe,expect,it} from "vitest";
import {computeMessagingEligibility,messagingPhone} from "@/services/messaging-eligibility";
const guest={id:"g",phone:"0712345678",email:"asha@example.invalid"};
const contributor={id:"c",guestId:"g",phone:"0612345678",email:null};
const guestConsent={guestId:"g",contributorId:null,status:"OPTED_IN"};
const contributorConsent={guestId:null,contributorId:"c",status:"OPTED_IN"};
describe("SMS consent identity restrictions",()=>{
 it("normalizes supported TZ phone formats without email fallback",()=>{
  expect(messagingPhone("+255 612 345 678")).toBe("255612345678");expect(messagingPhone("0712345678")).toBe("255712345678");expect(messagingPhone("asha@example.invalid")).toBe("");
  expect(computeMessagingEligibility([{...guest,phone:null}],[],[guestConsent],"SMS").eligible).toHaveLength(0);
 });
 it("blocks guest and contributor if either linked identity is unknown or opted out",()=>{
  for(const status of ["UNKNOWN","OPTED_OUT"]) expect(computeMessagingEligibility([guest],[contributor],[guestConsent,{...contributorConsent,status}],"SMS").eligible).toHaveLength(0);
  expect(computeMessagingEligibility([guest],[contributor],[contributorConsent],"SMS").eligible).toHaveLength(0);
 });
 it("requires both linked identities to opt in",()=>{
  expect(computeMessagingEligibility([guest],[contributor],[guestConsent,contributorConsent],"SMS").eligible).toHaveLength(2);
 });
 it("deduplicates destinations and uses the most restrictive duplicate consent",()=>{
  expect(computeMessagingEligibility([guest],[{...contributor,phone:guest.phone}],[guestConsent,contributorConsent],"SMS").eligible).toHaveLength(1);
  expect(computeMessagingEligibility([guest],[],[guestConsent,{...guestConsent,status:"OPTED_OUT"}],"SMS").eligible).toHaveLength(0);
 });
});
