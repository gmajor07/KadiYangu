/*
 * Read-only by default. Uploads only when --execute is explicitly supplied.
 * This script never edits database URLs and never deletes local files.
 */
const fs = require("node:fs");
const path = require("node:path");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const root = path.resolve(process.cwd(), "public/uploads");
const execute = process.argv.includes("--execute");
const verify = process.argv.includes("--verify") || execute;
const required = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"];
if (execute || verify) {
  for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`);
}
const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const client = execute || verify ? new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } }) : null;
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile()) files.push(absolute);
  }
}
walk(root);
const contentType = (file) => ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()];
(async () => {
  const results = [];
  for (const file of files) {
    const key = path.relative(root, file).split(path.sep).join("/");
    const type = contentType(file);
    if (!type) { results.push({ key, status: "skipped", reason: "unsupported extension" }); continue; }
    const result = { key, localBytes: fs.statSync(file).size, publicUrl: base ? `${base}/uploads/${key}` : null };
    if (execute) await client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: `uploads/${key}`, Body: fs.createReadStream(file), ContentType: type, CacheControl: "public, max-age=31536000, immutable" }));
    if (verify) { await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: `uploads/${key}` })); result.status = execute ? "uploaded-and-verified" : "verified"; }
    else result.status = "dry-run";
    results.push(result);
  }
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", count: results.length, databaseUrlsChanged: false, localFilesDeleted: false, files: results }, null, 2));
})().catch((error) => { console.error(`Media migration failed: ${error.message}`); process.exitCode = 1; });
