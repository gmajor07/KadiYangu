/* eslint-disable @typescript-eslint/no-require-imports -- pngjs is used only to decode fixture QR downloads in tests */
import {test,expect,type BrowserContext} from "@playwright/test";
import {encode} from "next-auth/jwt";
import QRCode from "qrcode";
import {BinaryBitmap,HybridBinarizer,RGBLuminanceSource,QRCodeReader} from "@zxing/library";
import {scannerFixture,cleanupScannerFixture,safeScannerDatabase} from "../scanner-fixture";
const {PNG}=require("pngjs") as {PNG:{sync:{read:(buffer:Buffer)=>{data:Buffer;width:number;height:number}}}};
if(!safeScannerDatabase())throw new Error("Only the isolated local scanner database is allowed.");
const baseURL=`http://localhost:${process.env.SCANNER_TEST_PORT||"3207"}`;
let fixture:Awaited<ReturnType<typeof scannerFixture>>;
test.beforeEach(async()=>{
 fixture=await scannerFixture();
 await fixture.db.event.update({where:{id:fixture.event.id},data:{status:"PUBLISHED"}});
 await fixture.db.guestPass.updateMany({where:{purchaseId:fixture.purchase.id},data:{guestName:null}});
});
test.afterEach(async()=>{
 if(fixture){await fixture.db.auditLog.deleteMany({where:{entityId:{in:fixture.passes.map(p=>p.id)}}});await fixture.db.rsvp.deleteMany({where:{eventId:fixture.event.id}});await cleanupScannerFixture(fixture);}
});
async function auth(context:BrowserContext,id=fixture.owner.id){
 const token=await encode({token:{sub:id},secret:process.env.AUTH_SECRET!,maxAge:3600});
 await context.addCookies([{name:"next-auth.session-token",value:token,url:`http://localhost:${process.env.SCANNER_TEST_PORT||"3207"}`,httpOnly:true,sameSite:"Lax"}]);
}
function decodePng(bytes:Buffer){
 const png=PNG.sync.read(bytes),gray=new Uint8ClampedArray(png.width*png.height);
 for(let i=0;i<gray.length;i++)gray[i]=Math.round((png.data[i*4]+png.data[i*4+1]+png.data[i*4+2])/3);
 return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,png.width,png.height)))).getText();
}
async function qrCamera(context:BrowserContext,token:string){
 const data=await QRCode.toDataURL(token,{width:600,margin:4});
 await context.addInitScript(({data})=>{
  Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{
   const canvas=document.createElement("canvas");canvas.width=768;canvas.height=768;
   const ctx=canvas.getContext("2d")!,image=new Image();image.src=data;await image.decode();
   const draw=()=>{ctx.fillStyle="white";ctx.fillRect(0,0,768,768);ctx.drawImage(image,84,84,600,600);};draw();const timer=setInterval(draw,80);
   const stream=canvas.captureStream(15);window.addEventListener("pagehide",()=>{clearInterval(timer);stream.getTracks().forEach(t=>t.stop());});return stream;
  }});
 },{data});
}

test("organizer invitation -> anonymous RSVP -> allocation -> same saved QR -> live scanner -> one check-in",async({page,context,browser})=>{
 await auth(context);await page.goto(`/dashboard/events/${fixture.event.id}/guests`);
 const article=page.getByRole("article",{name:"Asha guest"});
 await expect(article.getByText("Entry-pass status: Not allocated",{exact:true})).toBeVisible();
 await article.getByRole("button",{name:"View invitation QR",exact:true}).click();
 const dialog=page.getByRole("dialog");const invitation=await dialog.locator("p.break-all").innerText();
 expect(new URL(invitation).origin).toBe(`http://localhost:${process.env.SCANNER_TEST_PORT||"3207"}`);
 await dialog.getByRole("button",{name:"Close",exact:true}).click();
 const guestContext=await browser.newContext({baseURL,acceptDownloads:true}),guest=await guestContext.newPage();
 try{
  await guest.goto(new URL(`/i/${fixture.event.slug}`,invitation).href);
  await expect(guest.getByRole("heading",{name:"My Entry Pass",exact:true})).toHaveCount(0);
  const denied=await guest.request.get(`/api/invitations/${fixture.event.slug}/wrong-code/entry-pass?slot=1`);expect(denied.status()).toBe(404);
  await guest.goto(invitation);await expect(guest.getByText(/RSVP first/)).toBeVisible();
  const rsvp=guest.locator("form").filter({has:guest.locator('input[name="invitationCode"]')});
  await rsvp.locator('select[name="status"]').selectOption("ATTENDING");await rsvp.locator('input[name="guestCount"]').fill("1");await rsvp.getByRole("button",{name:"Submit RSVP"}).click();
  await expect(guest.getByText(/No entry pass has been allocated/)).toBeVisible();
  expect(await fixture.db.guestPass.count({where:{guestId:fixture.guest.id}})).toBe(0);
  await page.reload();await article.locator('input[name="confirmLink"]').check();await article.getByRole("button",{name:"Allocate Entry Pass",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:/Allocated 1 entry pass/})).toBeVisible();
  await expect(article.getByRole("link",{name:"View Entry Pass",exact:true})).toBeVisible();
  await guest.getByRole("button",{name:"Refresh pass status"}).click();
  await guest.getByRole("button",{name:"Show Pass",exact:true}).click();await expect(guest.getByRole("img",{name:"Guest entry-pass QR"})).toBeVisible();
  const downloadPromise=guest.waitForEvent("download");await guest.getByRole("button",{name:"Save this QR",exact:true}).click();const download=await downloadPromise;
  const stream=await download.createReadStream();if(!stream)throw new Error("Download missing");const chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks),token=decodePng(bytes);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(await guest.content()).not.toContain(token);
  await guest.getByRole("button",{name:"Close pass",exact:true}).click();await guest.goto(invitation);
  const png=await guest.request.get(`/api/invitations/${fixture.event.slug}/${fixture.guest.invitationCode}/entry-pass?slot=1`);expect(png.status()).toBe(200);expect(png.headers()["cache-control"]).toContain("no-store");expect(decodePng(await png.body())).toBe(token);
  const allocated=await fixture.db.guestPass.findFirstOrThrow({where:{guestId:fixture.guest.id}});expect(await fixture.db.guestPass.count({where:{purchaseId:fixture.purchase.id}})).toBe(3);
  const staffContext=await browser.newContext({baseURL});await auth(staffContext,fixture.staff.id);await qrCamera(staffContext,token);const staff=await staffContext.newPage();
  try{
   await staff.goto(new URL(`/dashboard/scanner?event=${fixture.event.id}`,invitation).href);await staff.getByRole("button",{name:"Start camera",exact:true}).click();await expect(staff.getByRole("heading",{name:"Entry approved",exact:true})).toBeVisible();
   expect(await fixture.db.checkIn.count({where:{passId:allocated.id}})).toBe(1);
   await staff.waitForTimeout(5100);await staff.getByRole("button",{name:"Scan next guest",exact:true}).click();await expect(staff.getByRole("heading",{name:"Already checked in",exact:true})).toBeVisible();expect(await fixture.db.checkIn.count({where:{passId:allocated.id}})).toBe(1);
  }finally{await staffContext.close();}
  await guest.goto(invitation);await expect(guest.getByText("Already checked in. This pass cannot admit another person.",{exact:true})).toBeVisible();await expect(guest.getByRole("button",{name:"Show Pass",exact:true})).toHaveCount(0);
 }finally{await guestContext.close();}
});

test("declined RSVP and public visitors cannot retrieve an allocated pass; wrong event/access stays denied",async({page,context,browser})=>{
 await auth(context);
 await fixture.db.rsvp.create({data:{eventId:fixture.event.id,guestId:fixture.guest.id,guestName:fixture.guest.name,status:"ATTENDING",guestCount:1}});
 await page.goto(`/dashboard/events/${fixture.event.id}/guests`);
 const article=page.getByRole("article",{name:"Asha guest"});await article.locator('input[name="confirmLink"]').check();await article.getByRole("button",{name:"Allocate Entry Pass",exact:true}).click();await expect(article.getByRole("link",{name:"View Entry Pass",exact:true})).toBeVisible();
 const guestContext=await browser.newContext({baseURL}),guest=await guestContext.newPage();
 try{
  await guest.goto(`/i/${fixture.event.slug}/g/${fixture.guest.invitationCode}`);const rsvp=guest.locator("form").filter({has:guest.locator('input[name="invitationCode"]')});await rsvp.locator('select[name="status"]').selectOption("NOT_ATTENDING");await rsvp.getByRole("button",{name:"Update RSVP"}).click();await expect(guest.getByRole("status").filter({hasText:/Your RSVP is declined/})).toBeVisible();await expect(guest.getByRole("button",{name:"Show Pass",exact:true})).toHaveCount(0);
  expect((await guest.request.get(`/api/invitations/${fixture.event.slug}/${fixture.guest.invitationCode}/entry-pass?slot=1`)).status()).toBe(404);
  expect((await guest.request.get(`/api/invitations/${fixture.otherEvent.slug}/${fixture.guest.invitationCode}/entry-pass?slot=1`)).status()).toBe(404);
  expect((await guest.request.get(`/api/events/${fixture.event.id}/guests/${fixture.guest.id}/entry-pass`)).status()).toBe(401);
  expect(await fixture.db.guestPass.count({where:{guestId:fixture.guest.id}})).toBe(1);
 }finally{await guestContext.close();}
 await context.clearCookies();await auth(context,fixture.other.id);
 expect((await page.request.get(`/api/events/${fixture.event.id}/guests/${fixture.guest.id}/entry-pass`)).status()).toBe(404);
 expect(await fixture.db.checkIn.count({where:{eventId:fixture.event.id}})).toBe(0);
});
