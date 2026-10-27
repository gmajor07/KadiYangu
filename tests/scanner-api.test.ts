import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),user:vi.fn(),checkIn:vi.fn()}));
vi.mock("next-auth",()=>({getServerSession:mocks.session}));
vi.mock("@/lib/auth/options",()=>({authOptions:{}}));
vi.mock("@/lib/db",()=>({getDb:()=>({user:{findUnique:mocks.user}})}));
vi.mock("@/services/guest-passes-qr",()=>({checkInGuestPass:mocks.checkIn}));
import {POST} from "@/app/api/events/[eventId]/check-in/route";
const token="a".repeat(43);
const params={params:Promise.resolve({eventId:"selected-event"})};
const request=(body:unknown={token},origin="https://example.test")=>new Request("https://example.test/api/events/selected-event/check-in",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
describe("scanner check-in HTTP boundary",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue({user:{id:"scanner"}});mocks.user.mockResolvedValue({id:"scanner",status:"ACTIVE"});});
 it("rejects cross-origin requests before authentication or attendance writes",async()=>{
  expect((await POST(request({token},"https://other.test"),params)).status).toBe(403);expect(mocks.session).not.toHaveBeenCalled();expect(mocks.checkIn).not.toHaveBeenCalled();
 });
 it("returns JSON authorization failures for expired sessions and inactive accounts",async()=>{
  mocks.session.mockResolvedValueOnce(null);expect(await (await POST(request(),params)).json()).toEqual({ok:false,reason:"UNAUTHORIZED"});
  mocks.user.mockResolvedValue({id:"scanner",status:"SUSPENDED"});expect((await POST(request(),params)).status).toBe(403);expect(mocks.checkIn).not.toHaveBeenCalled();
 });
 it("rejects invalid QR payloads without entering the check-in transaction",async()=>{
  for(const invalid of [123,"https://example.test/i/wedding/g/code",null])expect((await POST(request({token:invalid}),params)).status).toBe(400);
  expect(mocks.checkIn).not.toHaveBeenCalled();
 });
 it("uses the event in the authorized route, suppressing raw database IDs and tokens",async()=>{
  const entry={guestName:"Asha",allowedEntries:1,checkedIn:1,remaining:0};mocks.checkIn.mockResolvedValue({ok:true,passId:"private-id",entry});
  const response=await POST(request({token,eventId:"injected-event"}),params);expect(mocks.checkIn).toHaveBeenCalledWith("scanner","selected-event",token);expect(await response.json()).toEqual({ok:true,entry});expect(response.headers.get("cache-control")).toBe("no-store");
 });
 it("exposes wrong-event and duplicate results, without another event's details",async()=>{
  mocks.checkIn.mockResolvedValueOnce({ok:false,reason:"INVALID",detail:"WRONG_EVENT"});expect(await (await POST(request(),params)).json()).toEqual({ok:false,reason:"WRONG_EVENT"});
  mocks.checkIn.mockResolvedValueOnce({ok:false,reason:"ALREADY_USED"});expect((await POST(request(),params)).status).toBe(409);
 });
 it("fails closed on verification failure",async()=>{
  mocks.checkIn.mockRejectedValue(new Error("private database detail"));const response=await POST(request(),params);expect(response.status).toBe(503);expect(await response.json()).toEqual({ok:false,reason:"UNAVAILABLE"});
 });
});
