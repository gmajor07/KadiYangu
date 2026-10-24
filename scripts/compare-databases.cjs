/* Strictly read-only local/Railway comparison. Never run writes or migrations. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("dotenv").config({ quiet: true });
const { Client } = require("pg");

const localUrl = process.env.DATABASE_URL;
const railwayUrl = process.env.RAILWAY_DB_URL;
if (!localUrl || !railwayUrl) throw new Error("Set DATABASE_URL (local .env) and RAILWAY_DB_URL separately.");
function parsed(raw) { try { return new URL(raw); } catch { throw new Error("Invalid database URL."); } }
const local = parsed(localUrl); const production = parsed(railwayUrl);
const forbiddenProduction = ["localhost", "127.0.0.1", "::1"];
if (!forbiddenProduction.includes(local.hostname)) throw new Error("DATABASE_URL must target localhost for this tool.");
if (forbiddenProduction.includes(production.hostname) || production.hostname.endsWith(".railway.internal")) throw new Error("RAILWAY_DB_URL must use Railway public TCP proxy, not an internal/local host.");
if (local.href === production.href) throw new Error("Local and production URLs must be different.");

const tables = ["User", "EventCategory", "Template", "Design", "Organization", "OrganizationMember", "Event", "Guest", "EventWebsite", "EventScheduleItem", "EventGalleryItem", "Rsvp", "Order", "OrderItem", "Payment", "Entitlement", "ExportRecord", "SubscriptionPlan", "OrganizationSubscription", "OrganizationBillingRecord", "BetaGrant", "GuestPassPurchase", "EventStaff", "GuestPass", "CheckIn", "HeroSlide"];
const safeHash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
const maskId = (value) => value ? `…${safeHash(value)}` : null;
const hostLabel = (u) => `${u.hostname}:${u.port || "5432"}/${decodeURIComponent(u.pathname.slice(1))}`;
async function withReadOnly(url, expectedDatabase) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000, statement_timeout: 15000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const identity = await client.query("SELECT current_database() AS database, inet_server_addr()::text AS server");
    if (identity.rows[0].database !== expectedDatabase) throw new Error(`Unexpected database identity: ${expectedDatabase}`);
    return { client, identity: identity.rows[0] };
  } catch (error) { await client.end().catch(() => undefined); throw error; }
}
async function rows(client, sql) { return (await client.query(sql)).rows; }
async function collect(client) {
  const counts = {};
  for (const table of tables) counts[table] = Number((await rows(client, `SELECT count(*)::int AS count FROM "${table}"`))[0].count);
  const users = await rows(client, `SELECT id, lower(email) AS email, role, status FROM "User"`);
  const categories = await rows(client, `SELECT id, slug FROM "EventCategory"`);
  const templates = await rows(client, `SELECT id, slug, "categoryId" FROM "Template"`);
  const designs = await rows(client, `SELECT id, "userId", "organizationId", "templateId" FROM "Design"`);
  const organizations = await rows(client, `SELECT id, slug, "ownerUserId" FROM "Organization"`);
  const members = await rows(client, `SELECT id, "organizationId", "userId", role, status FROM "OrganizationMember"`);
  const events = await rows(client, `SELECT id, slug, "userId", "organizationId", "designId" FROM "Event"`);
  const guests = await rows(client, `SELECT id, "eventId", "invitationCode" FROM "Guest"`);
  const heroes = await rows(client, `SELECT id, "imageUrl", "sortOrder", "isActive" FROM "HeroSlide"`);
  return { counts, users, categories, templates, designs, organizations, members, events, guests, heroes };
}
function indexBy(rows, key) { return new Map(rows.map(row => [row[key], row])); }
function compare(localData, prodData) {
  const result = { counts: { local: localData.counts, production: prodData.counts }, users: {}, catalogs: {}, designs: {}, organizations: {}, events: {}, guests: {}, heroSlides: {}, commerce: {}, recommendation: "NO-GO", unresolved: [] };
  const prodUsers = indexBy(prodData.users, "email");
  const localUsers = indexBy(localData.users, "email");
  result.users = { insert: localData.users.filter(x => !prodUsers.has(x.email)).map(x => maskId(x.id)), reuse: localData.users.filter(x => prodUsers.has(x.email)).map(x => maskId(prodUsers.get(x.email).id)), emailMatches: localData.users.filter(x => prodUsers.has(x.email)).length, idCollisions: localData.users.filter(x => prodData.users.some(y => y.id === x.id && y.email !== x.email)).map(x => maskId(x.id)) };
  result.catalogs = { missingTemplates: localData.templates.filter(x => !prodData.templates.some(y => y.slug === x.slug)).map(x => x.slug), missingCategories: localData.categories.filter(x => !prodData.categories.some(y => y.slug === x.slug)).map(x => x.slug), existingTemplateSlugs: localData.templates.filter(x => prodData.templates.some(y => y.slug === x.slug)).map(x => x.slug) };
  const orgSlugs = new Set(prodData.organizations.map(x => x.slug));
  result.organizations = { insert: localData.organizations.filter(x => !orgSlugs.has(x.slug)).map(x => x.slug), reuse: localData.organizations.filter(x => orgSlugs.has(x.slug)).map(x => x.slug), membershipCount: localData.members.length };
  const eventSlugs = new Set(prodData.events.map(x => x.slug));
  result.events = { insert: localData.events.filter(x => !eventSlugs.has(x.slug)).map(x => x.slug), conflicts: localData.events.filter(x => eventSlugs.has(x.slug)).map(x => x.slug), missingDesignIds: localData.events.filter(x => !localData.designs.some(d => d.id === x.designId)).map(x => maskId(x.designId)), dependentGuestRows: localData.guests.length };
  const designIds = new Set(prodData.designs.map(x => x.id));
  result.designs = { insert: localData.designs.filter(x => !designIds.has(x.id)).map(x => maskId(x.id)), idCollisions: localData.designs.filter(x => designIds.has(x.id)).map(x => maskId(x.id)), missingTemplateIds: localData.designs.filter(x => x.templateId && !localData.templates.some(t => t.id === x.templateId)).map(x => maskId(x.templateId)) };
  result.guests = { invitationCodeCollisions: localData.guests.filter(x => prodData.guests.some(y => y.invitationCode === x.invitationCode)).map(x => maskId(x.id)), eventIdsMissingLocally: localData.guests.filter(x => !localData.events.some(e => e.id === x.eventId)).map(x => maskId(x.eventId)) };
  const heroDir = path.join(process.cwd(), "public", "uploads", "hero");
  const media = localData.heroes.map(x => { const filename = path.basename(x.imageUrl); const localPath = path.join(heroDir, filename); return { filename, localExists: fs.existsSync(localPath), r2Key: `uploads/hero/${filename}` }; });
  result.heroSlides = { insert: localData.heroes.filter(x => !prodData.heroes.some(y => y.id === x.id)).map(x => maskId(x.id)), existing: localData.heroes.filter(x => prodData.heroes.some(y => y.id === x.id)).map(x => maskId(x.id)), media };
  result.commerce = { localCounts: Object.fromEntries(["Order", "Payment", "Entitlement", "GuestPassPurchase", "GuestPass", "CheckIn", "OrganizationSubscription", "OrganizationBillingRecord", "BetaGrant"].map(t => [t, localData.counts[t]])), note: "Commerce and QR records require explicit review; this tool does not recommend automatic migration." };
  if (result.users.idCollisions.length || result.events.conflicts.length || result.designs.idCollisions.length || result.catalogs.missingTemplates.length || result.catalogs.missingCategories.length) result.unresolved.push("Stable-key or parent conflicts require manual review.");
  if (result.heroSlides.insert.length) result.unresolved.push("Hero media must be uploaded and verified in R2 before URL migration.");
  if (!result.unresolved.length) result.recommendation = "CONDITIONAL-GO: execute only after backup, R2 verification and final approval.";
  return result;
}
function markdown(report, hosts) { return `# KadiYangu Migration Audit\n\nGenerated: ${new Date().toISOString()}\n\n- Local target: ${hosts.local}\n- Production target: ${hosts.production}\n- Recommendation: **${report.recommendation}**\n\n## Counts\n\n| Table | Local | Production |\n|---|---:|---:|\n${Object.keys(report.counts.local).map(t => `| ${t} | ${report.counts.local[t]} | ${report.counts.production[t]} |`).join("\n")}\n\n## Comparison\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n## Safety\n\nThis report contains no credentials, password hashes, tokens or database URLs. No writes, migrations or R2 uploads were performed.\n`; }
(async () => {
  let a, b;
  try { a = await withReadOnly(localUrl, "kadiyangu"); b = await withReadOnly(railwayUrl, "railway"); const localData = await collect(a.client); const prodData = await collect(b.client); const report = compare(localData, prodData); const dir = path.join(process.cwd(), "reports", "migration-audit"); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "audit.json"), JSON.stringify(report, null, 2)); fs.writeFileSync(path.join(dir, "audit.md"), markdown(report, { local: hostLabel(local), production: hostLabel(production) })); console.log(`Audit complete: ${report.recommendation}`); await a.client.query("ROLLBACK"); await b.client.query("ROLLBACK"); await a.client.end(); await b.client.end();
  } catch (error) { if (a) await a.client.query("ROLLBACK").catch(() => undefined); if (b) await b.client.query("ROLLBACK").catch(() => undefined); if (a) await a.client.end().catch(() => undefined); if (b) await b.client.end().catch(() => undefined); console.error(`Read-only audit failed: ${error.message}`); process.exitCode = 1; }
})();
