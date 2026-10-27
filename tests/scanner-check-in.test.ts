import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({db:{$transaction:vi.fn(),event:{findFirst:vi.fn()},guestPass:{findUnique:vi.fn(),updateMany:vi.fn()},checkIn:{create:vi.fn()},$executeRaw:vi.fn()}}));
vi.mock("@/lib/db",()=>({getDb:()=>mocks.db}));
import {checkInGuestPass} from "@/services/guest-passes-qr";
const token="a".repeat(43);
describe("entry-pass transaction safety",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.db.$transaction.mockImplementation(callback=>callback(mocks.db));mocks.db.event.findFirst.mockResolvedValue({id:"event"});mocks.db.guestPass.findUnique.mockResolvedValue({id:"pass",eventId:"event",status:"ACTIVE",guestName:"Asha"});mocks.db.guestPass.updateMany.mockResolvedValue({count:1});});
 it("rejects invitation URLs and invalid tokens before database access",async()=>{
  for(const input of ["invalid","https://example.test/i/event/g/code"]){expect(await checkInGuestPass("user","event",input)).toMatchObject({ok:false,reason:"INVALID"});}expect(mocks.db.$transaction).not.toHaveBeenCalled();
 });
 it("does not read credentials or write attendance for unauthorized users",async()=>{
  mocks.db.event.findFirst.mockResolvedValue(null);expect(await checkInGuestPass("other","event",token)).toMatchObject({ok:false,reason:"UNAUTHORIZED"});expect(mocks.db.guestPass.findUnique).not.toHaveBeenCalled();expect(mocks.db.checkIn.create).not.toHaveBeenCalled();
 });
 it("rejects wrong-event credentials without guest data or writes",async()=>{
  mocks.db.guestPass.findUnique.mockResolvedValue({id:"pass",eventId:"other",guestName:"Private",status:"ACTIVE"});expect(await checkInGuestPass("user","event",token)).toEqual({ok:false,reason:"INVALID",detail:"WRONG_EVENT"});expect(mocks.db.guestPass.updateMany).not.toHaveBeenCalled();expect(mocks.db.checkIn.create).not.toHaveBeenCalled();
 });
 it("takes the replacement lock and records exactly one admission, without expanding RSVP plus-ones",async()=>{
  const result=await checkInGuestPass("user","event",token);expect(result).toMatchObject({ok:true,entry:{guestName:"Asha",allowedEntries:1,checkedIn:1,remaining:0}});
  expect(mocks.db.$executeRaw).toHaveBeenCalled();expect(mocks.db.guestPass.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:"pass",status:"ACTIVE"},data:expect.objectContaining({status:"CHECKED_IN"})}));expect(mocks.db.checkIn.create).toHaveBeenCalledTimes(1);
 });
 it("rejects repeated/revoked scans without new attendance writes",async()=>{
  for(const [status,reason] of [["CHECKED_IN","ALREADY_USED"],["REVOKED","REVOKED"]]){mocks.db.guestPass.findUnique.mockResolvedValue({id:"pass",eventId:"event",status,guestName:"Asha"});expect(await checkInGuestPass("user","event",token)).toMatchObject({ok:false,reason});}expect(mocks.db.checkIn.create).not.toHaveBeenCalled();
 });
 it("does not create a second check-in when an atomic claim loses a race",async()=>{
  mocks.db.guestPass.updateMany.mockResolvedValue({count:0});expect(await checkInGuestPass("user","event",token)).toMatchObject({ok:false,reason:"ALREADY_USED"});expect(mocks.db.checkIn.create).not.toHaveBeenCalled();
 });
});
