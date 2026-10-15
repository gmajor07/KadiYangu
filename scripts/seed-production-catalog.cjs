/* One-time, explicit Railway catalog import. Never run automatically. */
require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const dryRun = process.argv.includes("--dry-run");
const confirmed = process.argv.includes("--confirm-production");
const productionEnabled = process.env.ALLOW_PRODUCTION_CATALOG_IMPORT === "true";
const connection = new URL(process.env.DATABASE_URL || "postgresql://invalid");

const categories = [
  ["Wedding", "wedding", "Timeless invitations for your wedding day, from intimate ceremonies to joyful celebrations.", "royal-gold", "♡"],
  ["Birthday", "birthday", "Playful and thoughtful designs for another wonderful year around the sun.", "birthday", "✳"],
  ["Send-off", "send-off", "Bring family and friends together to celebrate a beautiful new beginning.", "send-off", "✧"],
  ["Kitchen Party", "kitchen-party", "Warm invitations for gathering, sharing wisdom, and celebrating the bride-to-be.", "kitchen-party", "❀"],
  ["Graduation", "graduation", "Celebrate hard work, proud moments, and the exciting chapter ahead.", "graduation", "☆"],
  ["Engagement", "engagement", "Share the happy news and invite your favourite people to celebrate your promise.", "engagement", "◇"],
  ["Baby Shower", "baby-shower", "Gentle, joyful invitations for welcoming a little one with so much love.", "baby-shower", "☀"],
  ["Anniversary", "anniversary", "Celebrate your story and all the beautiful years you have shared together.", "anniversary", "∞"],
];
const templates = [
  ["Royal Gold Wedding", "royal-gold-wedding", "wedding", "royal-gold", 15000, true],
  ["Elegant Floral Wedding", "elegant-floral-wedding", "wedding", "floral", null, true],
  ["Modern Birthday", "modern-birthday", "birthday", "birthday", null, true],
  ["Graduation Classic", "graduation-classic", "graduation", "graduation", 8000, true],
  ["Send-off Celebration", "send-off-celebration", "send-off", "send-off", 10000, false],
  ["Kitchen Party Botanical", "kitchen-party-botanical", "kitchen-party", "kitchen-party", null, false],
  ["Engagement Promise", "engagement-promise", "engagement", "engagement", 12000, false],
  ["Little Sunshine", "little-sunshine", "baby-shower", "baby-shower", null, false],
  ["Always Together", "always-together", "anniversary", "anniversary", 10000, false],
  ["Make a Wish", "make-a-wish", "birthday", "birthday-square", 5000, false],
];
function canonicalDesignData(art, width, height) {
  const source = fs.readFileSync(`public/demo/${art}.svg`, "utf8");
  const textElements = [...source.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)].map((match, index) => {
    const attrs = match[1]; const get = (key, fallback) => attrs.match(new RegExp(`${key}="([^"]+)"`))?.[1] || fallback;
    const fontSize = Number(get("font-size", "24")); const fill = { "royal-gold": "#faf3df", graduation: "#faf3df" }[art] || "#423d33";
    const x = Number(get("x", String(width / 2))); const y = Number(get("y", String(height / 2))); const editable = index === 1 || index === 2;
    const fieldKey = index === 1 ? "names" : index === 2 ? "message" : undefined;
    return { id: `${art}-text-${index}`, type: "text", x: x - width * 0.4, y: y - fontSize, width: width * 0.8, height: fontSize * 2, rotation: 0, text: match[2].replace(/<[^>]+>/g, "").trim(), editable, ...(fieldKey ? { fieldKey, fieldLabel: fieldKey === "names" ? "Names" : "Message", fieldType: fieldKey === "message" ? "textarea" : "text" } : {}), locked: !editable, style: { fontFamily: get("font-family", "Arial,sans-serif").split(",")[0], fontSize, fontWeight: get("font-weight", "400") === "bold" ? 700 : 400, letterSpacing: Number(get("letter-spacing", "0")), color: get("fill", fill), align: "center" } };
  });
  const elements = textElements.filter((element) => !/KADIYANGU\s*[·.]\s*DEMO DESIGN/i.test(element.text));
  return { version: 1, canvas: { width, height, backgroundColor: "#ffffff", backgroundImage: `/demo/layers/${art}.svg` }, fields: elements.filter((e) => e.fieldKey).map((e) => ({ key: e.fieldKey, label: e.fieldLabel, type: e.fieldType, elementId: e.id, allowMultiline: e.fieldType === "textarea", fitMode: "shrink", minFontSize: 12, maxLines: e.fieldType === "textarea" ? 3 : 1 })), elements };
}

function assertSafeTarget() {
  if (dryRun) return;
  if (!productionEnabled || !confirmed) throw new Error("Refusing production import. Set ALLOW_PRODUCTION_CATALOG_IMPORT=true and pass --confirm-production.");
  if (["localhost", "127.0.0.1", "::1"].includes(connection.hostname)) throw new Error("Refusing a local database target for production import.");
}

async function main() {
  assertSafeTarget();
  console.log(`Catalog import target: ${connection.hostname} (credentials hidden)`);
  console.log(`Planned changes: upsert ${categories.length} categories and ${templates.length} templates; no deletes.`);
  if (dryRun) { console.log("Dry run complete; database was not contacted."); return; }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }) });
  try {
    await db.$transaction(async (tx) => {
      const ids = new Map();
      for (const [index, [name, slug, description, art, icon]] of categories.entries()) {
        const row = await tx.eventCategory.upsert({ where: { slug }, update: { name, description, imageUrl: `/demo/${art}.svg`, icon, sortOrder: index, isActive: true }, create: { name, slug, description, imageUrl: `/demo/${art}.svg`, icon, sortOrder: index, isActive: true } });
        ids.set(slug, row.id);
      }
      for (const [name, slug, category, art, price, isFeatured] of templates) {
        const orientation = art === "graduation" ? "LANDSCAPE" : art === "birthday-square" ? "SQUARE" : "PORTRAIT";
        const width = orientation === "LANDSCAPE" ? 1600 : 1080; const height = orientation === "LANDSCAPE" ? 900 : orientation === "SQUARE" ? 1080 : 1350;
        const data = { name, description: `${name} is a KadiYangu invitation design.`, thumbnailUrl: `/demo/${art}.svg`, previewImageUrl: `/demo/${art}.svg`, categoryId: ids.get(category), isPremium: price !== null, price, currency: "TZS", status: "PUBLISHED", isFeatured, isActive: true, orientation, width, height, designData: canonicalDesignData(art, width, height) };
        // Existing records are preserved; only catalog visibility and category linkage are repaired.
        await tx.template.upsert({ where: { slug }, update: { categoryId: data.categoryId, status: "PUBLISHED", isActive: true }, create: { slug, ...data } });
      }
    }, { timeout: 30000 });
    console.log("Production catalog import complete: 8 categories and 10 templates upserted.");
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
