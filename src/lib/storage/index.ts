import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const MIME: Record<string, { ext: string; signature: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", signature: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", signature: b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  "image/webp": { ext: "webp", signature: b => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validateImage(bytes: Buffer, mime: string) { const rule = MIME[mime]; return Boolean(rule && bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES && rule.signature(bytes)); }
export function validateR2Configuration() { const values = [process.env.R2_ENDPOINT,process.env.R2_BUCKET,process.env.R2_ACCESS_KEY_ID,process.env.R2_SECRET_ACCESS_KEY,process.env.R2_PUBLIC_BASE_URL]; const any = values.some(Boolean); if (!any) { if (process.env.NODE_ENV === "production") throw new Error("R2 storage is required in production"); return null; } if (values.some(v => !v)) throw new Error("Incomplete R2 configuration"); const base = process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, ""); try { const url = new URL(base); if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("R2_PUBLIC_BASE_URL must use HTTPS"); } catch { throw new Error("Invalid R2_PUBLIC_BASE_URL"); } return { endpoint: process.env.R2_ENDPOINT!, bucket: process.env.R2_BUCKET!, accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!, base }; }
function config() { return validateR2Configuration(); }
/**
 * Keep object keys identical to the local public URL layout.  Local files are
 * served from /uploads/<key>, so R2 objects must live under uploads/ as well.
 * This is especially important for hero slides: older uploads using `hero/`
 * produce URLs that do not match the public R2 path.
 */
function keyFor(scope: string, ext: string) { const safe = scope.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "") || "media"; return `uploads/${safe}/${randomUUID()}.${ext}`; }
export async function putImage(scope: string, file: File) { const rule=MIME[file.type]; if(!rule||file.size<=0||file.size>MAX_IMAGE_BYTES)throw new Error("Invalid image file"); const bytes=Buffer.from(await file.arrayBuffer()); if(!validateImage(bytes,file.type))throw new Error("Image signature does not match its type"); const c=config(); const key=keyFor(scope,rule.ext); const publicKey=key.replace(/^uploads\//, ""); if(!c){const absolute=path.join(process.cwd(),"public","uploads",publicKey);await mkdir(path.dirname(absolute),{recursive:true});await writeFile(absolute,bytes,{flag:"wx"});return {key,url:`/uploads/${publicKey}`};} const client=new S3Client({region:"auto",endpoint:c.endpoint,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey}}); await client.send(new PutObjectCommand({Bucket:c.bucket,Key:key,Body:bytes,ContentType:file.type,CacheControl:"public, max-age=31536000, immutable"})); return {key,url:`${c.base}/${key}`}; }
export async function headObject(key:string) { const c=config(); if(!c) return false; const safe=key.replace(/^\/+/,""); if(!safe||safe.includes("..")) return false; const client=new S3Client({region:"auto",endpoint:c.endpoint,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey}}); try { await client.send(new HeadObjectCommand({Bucket:c.bucket,Key:safe})); return true; } catch { return false; } }
export async function deleteObject(key:string) { const c=config(); const safe=key.replace(/^\/+/,""); if(!safe||safe.includes("..")) throw new Error("Unsafe object key"); if(!c){await unlink(path.join(process.cwd(),"public","uploads",safe)).catch(()=>undefined);return;} const client=new S3Client({region:"auto",endpoint:c.endpoint,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey}}); await client.send(new DeleteObjectCommand({Bucket:c.bucket,Key:safe})); }
