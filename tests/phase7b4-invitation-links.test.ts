import { describe, expect, it } from "vitest";
import { personalizedInvitationPath } from "@/services/invitation-links";
describe("Phase 7B.4 invitation links",()=>{it("uses only slug and invitation code",()=>{const path=personalizedInvitationPath("wedding-event","abc_code");expect(path).toBe("/i/wedding-event/g/abc_code");expect(path).not.toContain("guestId");expect(path).not.toContain("eventId");});it("encodes path values safely",()=>expect(personalizedInvitationPath("my event","a/b")).toBe("/i/my%20event/g/a%2Fb"));});
