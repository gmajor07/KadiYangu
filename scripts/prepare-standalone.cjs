/* eslint-disable @typescript-eslint/no-require-imports -- standalone post-build script is CommonJS. */
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
const prismaTarget = path.join(standalone, "prisma");
copy(path.join(root, "prisma", "migrations"), path.join(prismaTarget, "migrations"));
copy(path.join(root, "prisma", "schema.prisma"), path.join(prismaTarget, "schema.prisma"));

const migrationDirectories = fs.readdirSync(path.join(prismaTarget, "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
if (migrationDirectories.length !== 8) {
  throw new Error(`Expected 8 Prisma migration directories, found ${migrationDirectories.length}.`);
}
console.log("Standalone assets prepared: public, .next/static, Prisma client runtime, migrations (8), and schema.prisma.");
