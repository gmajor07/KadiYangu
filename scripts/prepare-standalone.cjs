/* Copy assets that Next intentionally leaves beside standalone/server.js. */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Next standalone server.js was not generated.");
}
function copy(source, target) {
  fs.cpSync(source, target, { recursive: true, force: true });
}
copy(path.join(root, "public"), path.join(standalone, "public"));
copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copy(path.join(root, "node_modules", ".prisma", "client"), path.join(standalone, "node_modules", ".prisma", "client"));
console.log("Standalone assets prepared: public, .next/static and Prisma client runtime.");
