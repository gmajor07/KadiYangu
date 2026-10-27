import {test,expect,type BrowserContext} from "@playwright/test";
import {encode} from "next-auth/jwt";
import QRCode from "qrcode";
import {scannerFixture,cleanupScannerFixture,safeScannerDatabase} from "../scanner-fixture";
if(!safeScannerDatabase())throw new Error("Scanner browser tests require the isolated local scanner database.");
let fixture:Awaited<ReturnType<typeof scannerFixture>>;
test.beforeEach(async()=>{fixture=await scannerFixture();});
test.afterEach(async()=>{if(fixture)await cleanupScannerFixture(fixture);});
async function authenticate(context:BrowserContext,id=fixture.owner.id){
 const token=await encode({token:{sub:id},secret:process.env.AUTH_SECRET!,maxAge:3600});
 const port=process.env.SCANNER_TEST_PORT || "3207";
 await context.addCookies([{name:"next-auth.session-token",value:token,url:`http://localhost:${port}`,httpOnly:true,sameSite:"Lax"}]);
}
async function syntheticQrCamera(context:BrowserContext,value:string){
 const data=await QRCode.toDataURL(value,{width:600,margin:4,errorCorrectionLevel:"M"});
 await context.addInitScript(({data})=>{
  Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{
   const canvas=document.createElement("canvas");canvas.width=768;canvas.height=768;
   const ctx=canvas.getContext("2d")!;const image=new Image();image.src=data;await image.decode();
   const draw=()=>{ctx.fillStyle="white";ctx.fillRect(0,0,768,768);ctx.drawImage(image,84,84,600,600);};draw();
   const timer=window.setInterval(draw,80);const stream=canvas.captureStream(15);
   (window as unknown as {scannerTestStream:MediaStream}).scannerTestStream=stream;
   window.addEventListener("pagehide",()=>{clearInterval(timer);stream.getTracks().forEach(track=>track.stop());});
   return stream;
  }});
 },{data});
}

test("server selects event, shows no raw ID input, and refuses unauthorized selection",async({page,context})=>{
 await authenticate(context);await page.goto(`/dashboard/scanner?event=${fixture.event.id}`);
 await expect(page.getByRole("heading",{name:fixture.event.title})).toBeVisible();await expect(page.getByLabel("Event ID",{exact:true})).toHaveCount(0);
 expect((await page.request.get(`/dashboard/scanner?event=${fixture.event.id}`)).headers()["permissions-policy"]).toBe("camera=(self), microphone=(), geolocation=()");
 await page.goto("/dashboard/scanner");await expect(page.getByLabel("Event",{exact:true})).toBeVisible();
 await context.clearCookies();await authenticate(context,fixture.other.id);await page.goto(`/dashboard/scanner?event=${fixture.event.id}`);await expect(page.getByRole("heading",{name:"Event unavailable"})).toBeVisible();
 expect(await fixture.db.checkIn.count({where:{eventId:fixture.event.id}})).toBe(0);
});

test("browser camera API produces live preview with a virtual device",async({page,context})=>{
 await authenticate(context);await context.grantPermissions(["camera"]);
 await page.goto("/dashboard");
 await page.locator(`a[href="/dashboard/scanner?event=${fixture.event.id}"]`).click();
 await expect(page.getByRole("heading",{name:fixture.event.title})).toBeVisible();
 await page.getByRole("button",{name:"Start camera",exact:true}).click();
 await expect(page.getByRole("button",{name:"Stop camera",exact:true})).toBeVisible();
 await expect.poll(()=>page.locator("video").evaluate((video:HTMLVideoElement)=>video.videoWidth>0&&!video.paused&&video.srcObject instanceof MediaStream)).toBe(true);
 await page.getByRole("button",{name:"Stop camera",exact:true}).click();
 expect(await page.locator("video").evaluate((video:HTMLVideoElement)=>video.srcObject)).toBeNull();
});

test("real browser video pipeline decodes a synthetic QR and verifies it with the isolated server",async({page,context})=>{
 await authenticate(context);await syntheticQrCamera(context,fixture.tokens[0]);
 let posts=0;page.on("request",request=>{if(request.method()==="POST"&&request.url().includes("/check-in"))posts++;});
 await page.goto(`/dashboard/scanner?event=${fixture.event.id}`);await page.getByRole("button",{name:"Start camera",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Entry approved"})).toBeVisible();await expect(page.getByText("Asha",{exact:true})).toBeVisible();
 expect(await page.locator("video").evaluate((video:HTMLVideoElement)=>video.videoWidth>0&&video.srcObject instanceof MediaStream)).toBe(true);
 expect(await fixture.db.checkIn.count({where:{passId:fixture.passes[0].id}})).toBe(1);
 await page.waitForTimeout(1500);expect(posts).toBe(1);
 await page.getByRole("button",{name:"Stop camera",exact:true}).click();
 expect(await page.evaluate(()=>(window as unknown as {scannerTestStream:MediaStream}).scannerTestStream.getTracks().every(track=>track.readyState==="ended"))).toBe(true);
 await page.getByRole("button",{name:"Scan next guest"}).click();await page.waitForTimeout(5100);
 await page.getByRole("button",{name:"Start camera",exact:true}).click();await expect(page.getByRole("heading",{name:"Already checked in"})).toBeVisible();
 expect(await fixture.db.checkIn.count({where:{passId:fixture.passes[0].id}})).toBe(1);
 await page.getByRole("link",{name:"Change event"}).click();await expect(page.getByRole("heading",{name:"Choose an event"})).toBeVisible();
 expect(await page.evaluate(()=>(window as unknown as {scannerTestStream:MediaStream}).scannerTestStream.getTracks().every(track=>track.readyState==="ended"))).toBe(true);
});

for(const name of ["NotAllowedError","NotFoundError"]){
 test(`camera ${name} has actionable guidance and retry`,async({page,context})=>{
  await authenticate(context);await context.addInitScript(name=>{Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{throw new DOMException("Test camera failure",name);}});},name);
  await page.goto(`/dashboard/scanner?event=${fixture.event.id}`);await page.getByRole("button",{name:"Start camera",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:/camera/i})).toContainText(name==="NotAllowedError"?"denied":"No camera");await expect(page.getByRole("button",{name:"Retry camera"})).toBeVisible();
  expect(await fixture.db.checkIn.count({where:{eventId:fixture.event.id}})).toBe(0);
 });
}

test("invitation QR is rejected in the real decoder without posting check-in",async({page,context})=>{
 await authenticate(context);await syntheticQrCamera(context,`https://example.invalid/i/${fixture.event.slug}/g/${fixture.guest.invitationCode}`);
 let posts=0;page.on("request",request=>{if(request.url().includes("/check-in"))posts++;});
 await page.goto(`/dashboard/scanner?event=${fixture.event.id}`);await page.getByRole("button",{name:"Start camera",exact:true}).click();await expect(page.getByRole("heading",{name:"Invitation QR, not an entry pass"})).toBeVisible();expect(posts).toBe(0);
 expect(await fixture.db.checkIn.count({where:{eventId:fixture.event.id}})).toBe(0);
});

test("server returns wrong-event and rejects concurrent duplicate requests without extra attendance",async({page,context})=>{
 await authenticate(context);await page.goto(`/dashboard/scanner?event=${fixture.otherEvent.id}`);
 const wrong=await page.request.post(`/api/events/${fixture.otherEvent.id}/check-in`,{data:{token:fixture.tokens[0]}});expect(await wrong.json()).toEqual({ok:false,reason:"WRONG_EVENT"});
 const results=await Promise.all(Array.from({length:5},()=>page.request.post(`/api/events/${fixture.event.id}/check-in`,{data:{token:fixture.tokens[0]}})));
 expect(results.filter(r=>r.status()===200)).toHaveLength(1);expect(results.filter(r=>r.status()===409)).toHaveLength(4);
 expect(await fixture.db.checkIn.count({where:{passId:fixture.passes[0].id}})).toBe(1);
 await context.clearCookies();await authenticate(context,fixture.other.id);
 const denied=await page.request.post(`/api/events/${fixture.event.id}/check-in`,{data:{token:fixture.tokens[1]}});expect(denied.status()).toBe(403);
 expect(await fixture.db.checkIn.count({where:{eventId:fixture.event.id}})).toBe(1);
});

 test("unsupported camera browser exposes manual fallback without check-in writes",async({page,context})=>{
  await authenticate(context);await context.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:undefined});});
  await page.goto(`/dashboard/scanner?event=${fixture.event.id}`);await page.getByRole("button",{name:"Start camera",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:/camera/i})).toContainText("does not support camera access");
  await page.getByText("Optional manual fallback",{exact:true}).click();await expect(page.getByLabel("Entry-pass code",{exact:true})).toBeVisible();
  expect(await fixture.db.checkIn.count({where:{eventId:fixture.event.id}})).toBe(0);
 });
