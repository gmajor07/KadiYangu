import "server-only";
import QRCode from "qrcode";
export const privatePassHeaders={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff"};
export async function entryPassPng(token:string|null){
 if(!token)return Response.json({error:"Entry pass unavailable. Check your RSVP and contact the organizer."},{status:404,headers:privatePassHeaders});
 const image=await QRCode.toBuffer(token,{width:600,margin:4,errorCorrectionLevel:"M"});
 return new Response(new Uint8Array(image),{headers:{...privatePassHeaders,"Content-Type":"image/png","Content-Disposition":"inline; filename=entry-pass.png"}});
}
