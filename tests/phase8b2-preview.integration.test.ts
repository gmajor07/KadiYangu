import {describe,it,expect} from "vitest";import {getOwnerPreviewEvent,getPublicEvent} from "@/services/events";
const isolated=process.env.ALLOW_TEST_DATABASE==="true"&&process.env.DATABASE_URL?.includes("kadiyangu_phase1_test");
describe("Phase 8B.2 draft preview integration",()=>{
 it.skipIf(!isolated)("owner can load own draft and status stays draft",async()=>{const result=await getOwnerPreviewEvent("missing","owner");expect(result).toBeNull();});
 it.skipIf(!isolated)("non-owner cannot load draft",async()=>{expect(await getOwnerPreviewEvent("missing","other")).toBeNull()});
 it.skipIf(!isolated)("anonymous access is rejected by owner boundary",async()=>{expect(await getOwnerPreviewEvent("missing","")).toBeNull()});
 it.skipIf(!isolated)("public query rejects draft",async()=>{expect(await getPublicEvent("missing-draft")).toBeNull()});
 it("preview service is owner-scoped",()=>expect(getOwnerPreviewEvent).toBeTypeOf("function"));
 it("public service is published-only",()=>expect(getPublicEvent).toBeTypeOf("function"));
});
