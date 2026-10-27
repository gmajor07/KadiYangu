import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({db:{event:{findFirst:vi.fn(),findMany:vi.fn()}}}));
vi.mock("@/lib/db",()=>({getDb:()=>mocks.db}));
import {resolveScannerEvent,scannerEventAccess} from "@/services/scanner";
import {parseEntryQr,ScanGate,scanFeedback} from "@/lib/scanner/contracts";
import {cameraErrorMessage,QrCameraSession} from "@/lib/scanner/camera";
const token="A".repeat(43);
describe("scanner event resolution",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("auto-selects an authorized event by query, without arbitrary event-ID input",async()=>{
  mocks.db.event.findFirst.mockResolvedValue({id:"event",title:"Wedding"});
  expect(await resolveScannerEvent("user","event")).toEqual({kind:"selected",event:{id:"event",title:"Wedding"}});
  expect(mocks.db.event.findFirst).toHaveBeenCalledWith({where:{AND:[{id:"event"},scannerEventAccess("user")]},select:{id:true,title:true}});
 });
 it("denies unauthorized/mismatched IDs and ambiguous duplicate event parameters",async()=>{
  mocks.db.event.findFirst.mockResolvedValue(null);expect(await resolveScannerEvent("user","other")).toEqual({kind:"denied"});
  mocks.db.event.findFirst.mockClear();expect(await resolveScannerEvent("user",["one","two"])).toEqual({kind:"denied"});expect(mocks.db.event.findFirst).not.toHaveBeenCalled();
 });
 it("provides only owner/staff events when no event is specified",async()=>{
  mocks.db.event.findMany.mockResolvedValue([]);expect(await resolveScannerEvent("user",undefined)).toEqual({kind:"picker",events:[]});expect(mocks.db.event.findMany).toHaveBeenCalledWith(expect.objectContaining({where:scannerEventAccess("user")}));
 });
});
describe("entry QR contracts",()=>{
 it("accepts only current raw entry tokens, never invitation URLs/codes",()=>{
  expect(parseEntryQr(token)).toEqual({ok:true,token});expect(parseEntryQr("https://example.test/i/wedding/g/invitation-code")).toEqual({ok:false,reason:"INVITATION_QR"});
  for(const text of ["", "invalid", "x".repeat(32),`javascript:${token}`,`{\"token\":\"${token}\"}`])expect(parseEntryQr(text).ok).toBe(false);
 });
 it("blocks simultaneous callbacks and repeated scans, allowing subsequent guests",()=>{
  const gate=new ScanGate(5000);expect(gate.claim(token,0)).toBe(true);expect(gate.claim("another",1)).toBe(false);gate.release();expect(gate.claim(token,100)).toBe(false);expect(gate.claim("another",100)).toBe(true);gate.release();expect(gate.claim(token,5001)).toBe(true);
 });
 it("distinguishes wrong-event, duplicate and invalid results without claiming approval",()=>{
  for(const reason of ["WRONG_EVENT","ALREADY_USED","INVALID","INVITATION_QR","UNAUTHORIZED","UNAVAILABLE"])expect(scanFeedback({ok:false,reason}).tone).toBe("error");
 });
});
describe("camera session lifecycle (mock devices, not hardware certification)",()=>{
 const track={stop:vi.fn(),addEventListener:vi.fn()};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]} as unknown as MediaStream;
 const video={play:vi.fn().mockResolvedValue(undefined),pause:vi.fn(),srcObject:null,muted:false,playsInline:false} as unknown as HTMLVideoElement;
 const controls={stop:vi.fn()};
 const media={getUserMedia:vi.fn(),enumerateDevices:vi.fn()};
 const decoder={decodeFromStream:vi.fn()};
 const factory=vi.fn();
 beforeEach(()=>{vi.clearAllMocks();media.getUserMedia.mockResolvedValue(stream);decoder.decodeFromStream.mockResolvedValue(controls);factory.mockResolvedValue(decoder);});
 afterEach(()=>{video.srcObject=null;});
 it("attaches a real stream to an already mounted video and requests rear camera",async()=>{
  const onCode=vi.fn();const session=new QrCameraSession(onCode,vi.fn(),{media,createDecoder:factory});
  expect(await session.start(video)).toBe(true);expect(video.srcObject).toBe(stream);expect(video.play).toHaveBeenCalled();expect(media.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({video:expect.objectContaining({facingMode:{ideal:"environment"}})}));
  decoder.decodeFromStream.mock.calls[0][2]({getText:()=>token});expect(onCode).toHaveBeenCalledWith(token);session.stop();expect(track.stop).toHaveBeenCalled();expect(controls.stop).toHaveBeenCalled();expect(video.srcObject).toBeNull();
 });
 it("supports explicit desktop camera selection and fallback constraints",async()=>{
  const session=new QrCameraSession(vi.fn(),vi.fn(),{media,createDecoder:factory});await session.start(video,"desktop-camera");expect(media.getUserMedia).toHaveBeenCalledWith({audio:false,video:{deviceId:{exact:"desktop-camera"}}});session.stop();
  media.getUserMedia.mockRejectedValueOnce({name:"OverconstrainedError"}).mockResolvedValueOnce(stream);
  const fallback=new QrCameraSession(vi.fn(),vi.fn(),{media,createDecoder:factory});await fallback.start(video);expect(media.getUserMedia).toHaveBeenLastCalledWith({audio:false,video:true});fallback.stop();
 });
 it("reports permission denial and no-camera states without starting a decoder",async()=>{
  for(const name of ["NotAllowedError","NotFoundError"]){media.getUserMedia.mockRejectedValue({name});const session=new QrCameraSession(vi.fn(),vi.fn(),{media,createDecoder:factory});await expect(session.start(video)).rejects.toEqual({name});expect(factory).not.toHaveBeenCalled();}
  expect(cameraErrorMessage({name:"NotAllowedError"})).toContain("denied");expect(cameraErrorMessage({name:"NotFoundError"})).toContain("No camera");
 });
 it("releases a stream acquired after Stop/unmount and never attaches it",async()=>{
  let resolve!:(stream:MediaStream)=>void;media.getUserMedia.mockReturnValue(new Promise<MediaStream>(r=>{resolve=r;}));
  const session=new QrCameraSession(vi.fn(),vi.fn(),{media,createDecoder:factory});const started=session.start(video);session.stop();resolve(stream);expect(await started).toBe(false);expect(track.stop).toHaveBeenCalled();expect(factory).not.toHaveBeenCalled();expect(video.srcObject).toBeNull();
 });
 it("ignores decoded results after stop and reports a disconnected camera",async()=>{
  const onCode=vi.fn(),onFailure=vi.fn();const session=new QrCameraSession(onCode,onFailure,{media,createDecoder:factory});await session.start(video);
  const ended=track.addEventListener.mock.calls[0][1];ended();expect(onFailure).toHaveBeenCalledWith({name:"NotReadableError"});decoder.decodeFromStream.mock.calls[0][2]({getText:()=>token});expect(onCode).not.toHaveBeenCalled();
 });
});
