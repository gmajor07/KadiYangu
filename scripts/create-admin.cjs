/* Explicit admin bootstrap utility. Never run during app startup/build. */
require("dotenv").config({ quiet: true });
const { randomBytes, scryptSync } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim();
const password = process.env.ADMIN_PASSWORD;
const confirmed = process.argv.includes("--confirm");
const production = process.env.NODE_ENV === "production" || process.argv.includes("--production");
if (!email || !name || !password) throw new Error("Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD for this one-time command.");
if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
if (production && (!confirmed || process.env.ALLOW_ADMIN_BOOTSTRAP !== "true")) throw new Error("Production requires ALLOW_ADMIN_BOOTSTRAP=true and --confirm.");
const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (production && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Production mode cannot target localhost.");

const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt-v1$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 67108864 }).toString("hex")}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }) });
(async () => { try {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { name, passwordHash, role: "ADMIN", status: "ACTIVE" }, select: { email: true, role: true, status: true } })
    : await db.user.create({ data: { email, name, passwordHash, role: "ADMIN", status: "ACTIVE" }, select: { email: true, role: true, status: true } });
  console.log(`Admin ready: ${user.email} (${user.role}, ${user.status}). Password was not written to any file.`);
} finally { await db.$disconnect(); } })().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
