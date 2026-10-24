/*
 * Controlled local -> Railway data migration. Dry-run is the default.
 * Commerce, payment, entitlement, Beta and QR records are intentionally
 * excluded and cause dependency warnings instead of broken inserts.
 */
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { serializeJsonValue } = require("./serialize-json.cjs");
const localUrl = process.env.DATABASE_URL;
const railwayUrl = process.env.RAILWAY_DB_URL;
if (!localUrl || !railwayUrl) throw new Error("Set local DATABASE_URL and RAILWAY_DB_URL.");
function url(raw) { try { return new URL(raw); } catch { throw new Error("Invalid database URL"); } }
const localParsed = url(localUrl); const railwayParsed = url(railwayUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(localParsed.hostname)) throw new Error("DATABASE_URL must be local.");
if (["localhost", "127.0.0.1", "::1"].includes(railwayParsed.hostname) || railwayParsed.hostname.endsWith(".railway.internal")) throw new Error("RAILWAY_DB_URL must use Railway public TCP proxy.");
const execute = process.argv.includes("--execute");
const reportDir = path.join(process.cwd(), "reports", "migration-audit");
const safeId = (value) => `…${crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12)}`;
const jsonColumns = new Set(["designData", "sectionOrder", "visibleSections", "people"]);
async function open(raw, name) { const c = new Client({ connectionString: raw, connectionTimeoutMillis: 8000, statement_timeout: 20000 }); await c.connect(); await c.query("BEGIN READ ONLY"); const identity = (await c.query("SELECT current_database() AS db")).rows[0].db; if (identity !== name) throw new Error(`Unexpected database identity: ${name}`); return c; }
async function all(c, table, columns = "*") { return (await c.query(`SELECT ${columns} FROM "${table}"`)).rows; }
async function count(c, table) { return Number((await c.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n); }
const coreCounts = ["User", "EventCategory", "Template", "Organization", "OrganizationMember", "OrganizationInvitation", "Design", "Event", "EventWebsite", "EventScheduleItem", "EventGalleryItem", "Guest", "Rsvp", "HeroSlide"];
const excluded = ["Order", "OrderItem", "Payment", "Entitlement", "ExportRecord", "SubscriptionPlan", "OrganizationSubscription", "OrganizationBillingRecord", "BetaGrant", "GuestPassPurchase", "EventStaff", "GuestPass", "CheckIn", "AuditLog"];
function sameBy(a, b, key) { const keys = new Set(b.map(x => x[key])); return a.filter(x => keys.has(x[key])); }
async function preflight(source, target) {
  const local = {}, prod = {}; for (const t of coreCounts) { local[t] = await all(source, t); prod[t] = await all(target, t); }
  const prodEmails = new Set(prod.User.map(x => x.email.toLowerCase()));
  const prodTemplate = new Set((await all(target, "Template", '"slug"')).map(x => x.slug));
  const prodCategory = new Set((await all(target, "EventCategory", '"slug"')).map(x => x.slug));
  const prodOrg = new Set(prod.Organization.map(x => x.slug));
  const prodEvent = new Set(prod.Event.map(x => x.slug));
  const preview = { counts: {}, inserts: {}, reuses: {}, skipped: {}, conflicts: [], excludedDependencies: {}, heroMedia: [], recommendation: "GO" };
  for (const t of coreCounts) { preview.counts[t] = { local: local[t].length, production: prod[t].length }; preview.inserts[t] = 0; }
  preview.inserts.User = local.User.filter(x => !prodEmails.has(x.email.toLowerCase())).length;
  preview.reuses.User = local.User.length - preview.inserts.User;
  preview.inserts.Template = 0; preview.reuses.Template = local.Template.length; preview.skipped.Template = local.Template.length;
  preview.inserts.EventCategory = 0; preview.reuses.EventCategory = local.EventCategory.length; preview.skipped.EventCategory = local.EventCategory.length;
  for (const t of ["Design", "Organization", "OrganizationMember", "OrganizationInvitation", "Event", "EventWebsite", "EventScheduleItem", "EventGalleryItem", "Guest", "Rsvp", "HeroSlide"]) { preview.inserts[t] = local[t].filter(x => !prod[t].some(y => y.id === x.id)).length; for (const row of local[t]) if (prod[t].some(x => x.id === row.id)) preview.conflicts.push({ table: t, id: safeId(row.id), reason: "ID collision" }); }
  for (const x of local.Event) if (prodEvent.has(x.slug)) preview.conflicts.push({ table: "Event", key: x.slug });
  for (const x of local.Organization) if (prodOrg.has(x.slug)) preview.conflicts.push({ table: "Organization", key: x.slug });
  for (const x of local.Design) if (x.templateId && !(await all(target, "Template", 'id, slug')).some(y => y.id === x.templateId || prodTemplate.has(y.slug))) preview.conflicts.push({ table: "Design", id: safeId(x.id), reason: "template mapping required" });
  preview.excludedDependencies = {};
  for (const t of excluded) preview.excludedDependencies[t] = await count(source, t).catch(() => 0);
  const heroRoot = path.join(process.cwd(), "public", "uploads", "hero");
  const r2Base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || null;
  for (const h of local.HeroSlide) { const filename = path.basename(h.imageUrl); preview.heroMedia.push({ filename, exists: fs.existsSync(path.join(heroRoot, filename)), r2Key: `uploads/hero/${filename}`, publicUrl: r2Base ? `${r2Base}/uploads/hero/${filename}` : null }); }
  preview.excludedSummary = "Excluded local commerce/Beta/QR records remain untouched; they do not block independent core rows unless a parent mapping is unresolved.";
  if (preview.conflicts.length || preview.heroMedia.some(x => !x.exists)) preview.recommendation = "NO-GO";
  return { local, prod, preview };
}
async function insert(c, table, row, columns) { const cols = columns.filter(k => Object.hasOwn(row, k)); const values = cols.map(k => jsonColumns.has(k) ? serializeJsonValue(row[k]) : row[k]); const marks = cols.map((_, i) => `$${i + 1}`).join(","); try { await c.query(`INSERT INTO "${table}" (${cols.map(x => `"${x}"`).join(",")}) VALUES (${marks}) ON CONFLICT DO NOTHING`, values); } catch (error) { const jsonFields = cols.filter(k => jsonColumns.has(k)); throw new Error(`Insert failed for ${table}${jsonFields.length ? ` (JSON fields: ${jsonFields.join(",")})` : ""}: ${error.message}`); } }
async function executeCore(source, target, local, prod, preview) {
  if (preview.conflicts.length || preview.heroMedia.some(x => !x.exists)) throw new Error("Unresolved core conflicts or missing hero media; refusing production write.");
  const users = new Map(); const prodByEmail = new Map(prod.User.map(x => [x.email.toLowerCase(), x]));
  const templateMap = new Map((await all(target, "Template", 'id,slug')).map(x => [x.slug, x.id]));
  for (const row of local.User) { const existing = prodByEmail.get(row.email.toLowerCase()); users.set(row.id, existing?.id || row.id); if (!existing) await insert(target, "User", row, ["id", "name", "email", "phone", "passwordHash", "role", "status", "emailVerified", "createdAt", "updatedAt"]); }
  for (const row of local.Organization) await insert(target, "Organization", { ...row, ownerUserId: users.get(row.ownerUserId) || row.ownerUserId }, ["id", "name", "slug", "type", "status", "ownerUserId", "createdAt", "updatedAt"]);
  const orgMap = new Map((await all(target, "Organization", 'id,slug')).map(x => [x.slug, x.id]));
  for (const row of local.OrganizationMember) await insert(target, "OrganizationMember", { ...row, organizationId: orgMap.get(local.Organization.find(o => o.id === row.organizationId)?.slug) || row.organizationId, userId: users.get(row.userId) || row.userId }, ["id", "organizationId", "userId", "role", "status", "createdAt", "updatedAt"]);
  for (const row of local.OrganizationInvitation) await insert(target, "OrganizationInvitation", { ...row, organizationId: orgMap.get(local.Organization.find(o => o.id === row.organizationId)?.slug) || row.organizationId, invitedByUserId: users.get(row.invitedByUserId) || row.invitedByUserId }, ["id", "organizationId", "email", "role", "tokenHash", "invitedByUserId", "expiresAt", "acceptedAt", "createdAt"]);
  for (const row of local.Design) { const templateSlug = local.Template.find(t => t.id === row.templateId)?.slug; await insert(target, "Design", { ...row, userId: users.get(row.userId) || row.userId, templateId: templateSlug ? templateMap.get(templateSlug) : null, organizationId: row.organizationId ? orgMap.get(local.Organization.find(o => o.id === row.organizationId)?.slug) : null }, ["id", "userId", "templateId", "organizationId", "name", "designData", "width", "height", "orientation", "thumbnailUrl", "status", "createdAt", "updatedAt"]); }
  for (const row of local.Event) await insert(target, "Event", { ...row, userId: users.get(row.userId) || row.userId, organizationId: row.organizationId ? orgMap.get(local.Organization.find(o => o.id === row.organizationId)?.slug) : null }, ["id", "userId", "designId", "organizationId", "title", "slug", "eventType", "eventDate", "startTime", "endTime", "venue", "locationText", "latitude", "longitude", "description", "status", "publishedAt", "createdAt", "updatedAt"]);
  const eventIds = new Set(local.Event.map(x => x.id));
  for (const table of ["EventWebsite", "EventScheduleItem", "EventGalleryItem", "Guest", "Rsvp"]) for (const row of local[table]) if (eventIds.has(row.eventId)) await insert(target, table, row, Object.keys(row));
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_BASE_URL is required before HeroSlide migration.");
  for (const row of local.HeroSlide) { const filename = path.basename(row.imageUrl); await insert(target, "HeroSlide", { ...row, imageUrl: `${base}/uploads/hero/${filename}` }, Object.keys(row)); }
}
(async () => { let source, target; try { source = await open(localUrl, "kadiyangu"); target = await open(railwayUrl, "railway"); const first = await preflight(source, target); fs.mkdirSync(reportDir, { recursive: true }); fs.writeFileSync(path.join(reportDir, "migration-preview.json"), JSON.stringify(first.preview, null, 2)); console.log(JSON.stringify(first.preview, null, 2)); if (execute) { await target.query("ROLLBACK"); await target.query("BEGIN READ ONLY"); const latest = await preflight(source, target); await target.query("ROLLBACK"); await target.query("BEGIN"); await executeCore(source, target, latest.local, latest.prod, latest.preview); await target.query("COMMIT"); console.log("Migration committed; run post-migration verification."); } else console.log("Dry-run only; no production writes performed."); await source.query("ROLLBACK"); await target.query("ROLLBACK"); await source.end(); await target.end(); } catch (e) { if (target) await target.query("ROLLBACK").catch(() => {}); if (source) await source.query("ROLLBACK").catch(() => {}); if (source) await source.end().catch(() => {}); if (target) await target.end().catch(() => {}); console.error(`Migration refused: ${e.message}`); process.exitCode = 1; } })();
