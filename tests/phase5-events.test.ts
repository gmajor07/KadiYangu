import {describe,expect,it} from "vitest";import {expectedGuestCount} from "@/services/events";
describe("Phase 5 event RSVP rules",()=>{
it("counts only attending guests",()=>{expect(expectedGuestCount([{status:"ATTENDING",guestCount:2},{status:"NOT_ATTENDING",guestCount:9}])).toBe(2)});
it("handles multiple attending responses",()=>{expect(expectedGuestCount([{status:"ATTENDING",guestCount:1},{status:"ATTENDING",guestCount:3}])).toBe(4)});
it("ignores invalid negative guest counts",()=>{expect(expectedGuestCount([{status:"ATTENDING",guestCount:-2}])).toBe(0)});
it("returns zero with no responses",()=>{expect(expectedGuestCount([])).toBe(0)});
it("does not count unknown statuses",()=>{expect(expectedGuestCount([{status:"MAYBE",guestCount:4}])).toBe(0)});
});
