import "server-only";
import {createCipheriv,createDecipheriv,createHash,hkdfSync,randomBytes} from "node:crypto";
import {isEntryPassToken} from "@/lib/scanner/contracts";
function key(){
 const secret=process.env.ENTRY_PASS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
 if(!secret || secret.length<32 || secret.startsWith("REPLACE_"))throw new Error("Secure pass retrieval is not configured.");
 return Buffer.from(hkdfSync("sha256",secret,"KadiYangu","entry-pass-storage-v1",32));
}
export function passRetrievalConfigured(){try{key();return true;}catch{return false;}}
export const entryTokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
type Binding={id:string;eventId:string;replacementRevision:number};
const aad=(binding:Binding)=>Buffer.from(JSON.stringify([binding.id,binding.eventId,binding.replacementRevision]));
export function sealEntryToken(token:string,binding:Binding){
 if(!isEntryPassToken(token))throw new Error("Invalid entry token.");
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);cipher.setAAD(aad(binding));
 const encrypted=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
 return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function openEntryToken(envelope:string,binding:Binding,hash:string){
 try{
  const [version,iv,tag,ciphertext,...extra]=envelope.split(".");
  if(version!=="v1"||extra.length||!iv||!tag||!ciphertext)return null;
  const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));decipher.setAAD(aad(binding));decipher.setAuthTag(Buffer.from(tag,"base64url"));
  const token=Buffer.concat([decipher.update(Buffer.from(ciphertext,"base64url")),decipher.final()]).toString("utf8");
  return isEntryPassToken(token)&&entryTokenHash(token)===hash?token:null;
 }catch{return null;}
}
