/* eslint-disable @typescript-eslint/no-require-imports -- Explicit local Node seed script. */
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const fs = require("node:fs");
const htmlEntities = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
function canonicalDesignData(art, width, height) {
  const source = fs.readFileSync(`public/demo/${art}.svg`, "utf8");
  const textElements = [...source.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)].map((match, index) => {
    const attrs = match[1]; const get = (key, fallback) => attrs.match(new RegExp(`${key}="([^"]+)"`))?.[1] || fallback;
    const fontSize = Number(get("font-size", "24")); const palette = { "royal-gold": "#faf3df", graduation: "#faf3df" }; const inheritedFill = palette[art] || "#423d33"; const x = Number(get("x", String(width / 2))); const y = Number(get("y", String(height / 2)));
    const editable = index === 1 || index === 2; const fieldKey = index === 1 ? "names" : index === 2 ? "message" : undefined;
    return { id: `${art}-text-${index}`, type: "text", x: x - width * 0.4, y: y - fontSize, width: width * 0.8, height: fontSize * 2, rotation: 0, text: htmlEntities(match[2].replace(/<[^>]+>/g, "").trim()), editable, ...(fieldKey ? { fieldKey, fieldLabel: fieldKey === "names" ? "Names" : "Message", fieldType: fieldKey === "message" ? "textarea" : "text" } : {}), locked: !editable, style: { fontFamily: get("font-family", "Arial,sans-serif").split(",")[0], fontSize, fontWeight: get("font-weight", "400") === "bold" ? 700 : 400, letterSpacing: Number(get("letter-spacing", "0")), color: get("fill", inheritedFill), align: "center" } };
  });
  const elements = textElements.filter((element) => !/KADIYANGU\s*[·.]\s*DEMO DESIGN/i.test(element.text));
  return { version: 1, canvas: { width, height, backgroundColor: "#ffffff", backgroundImage: `/demo/layers/${art}.svg` }, fields: elements.filter((e) => e.fieldKey).map((e) => ({ key: e.fieldKey, label: e.fieldLabel, type: e.fieldType, elementId: e.id, allowMultiline: e.fieldType === "textarea", fitMode: "shrink", minFontSize: 12, maxLines: e.fieldType === "textarea" ? 3 : 1 })), elements };
}

const url = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEMO_SEED !== "true" ||
  !["localhost", "127.0.0.1"].includes(url.hostname)
) {
  console.error(
    "Demo seeding is local development only. Set ALLOW_DEMO_SEED=true with a local DATABASE_URL; never seed during deployment.",
  );
  process.exit(1);
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }),
});
const categories = [
  [
    "Wedding",
    "wedding",
    "Timeless invitations for your wedding day, from intimate ceremonies to joyful celebrations.",
    "royal-gold",
    "♡",
  ],
  [
    "Birthday",
    "birthday",
    "Playful and thoughtful designs for another wonderful year around the sun.",
    "birthday",
    "✳",
  ],
  [
    "Send-off",
    "send-off",
    "Bring family and friends together to celebrate a beautiful new beginning.",
    "send-off",
    "✧",
  ],
  [
    "Kitchen Party",
    "kitchen-party",
    "Warm invitations for gathering, sharing wisdom, and celebrating the bride-to-be.",
    "kitchen-party",
    "❀",
  ],
  [
    "Graduation",
    "graduation",
    "Celebrate hard work, proud moments, and the exciting chapter ahead.",
    "graduation",
    "☆",
  ],
  [
    "Engagement",
    "engagement",
    "Share the happy news and invite your favourite people to celebrate your promise.",
    "engagement",
    "◇",
  ],
  [
    "Baby Shower",
    "baby-shower",
    "Gentle, joyful invitations for welcoming a little one with so much love.",
    "baby-shower",
    "☀",
  ],
  [
    "Anniversary",
    "anniversary",
    "Celebrate your story and all the beautiful years you have shared together.",
    "anniversary",
    "∞",
  ],
];
const templates = [
  [
    "Royal Gold Wedding",
    "royal-gold-wedding",
    "wedding",
    "royal-gold",
    15000,
    true,
  ],
  [
    "Elegant Floral Wedding",
    "elegant-floral-wedding",
    "wedding",
    "floral",
    null,
    true,
  ],
  ["Modern Birthday", "modern-birthday", "birthday", "birthday", null, true],
  [
    "Graduation Classic",
    "graduation-classic",
    "graduation",
    "graduation",
    8000,
    true,
  ],
  [
    "Send-off Celebration",
    "send-off-celebration",
    "send-off",
    "send-off",
    10000,
    false,
  ],
  [
    "Kitchen Party Botanical",
    "kitchen-party-botanical",
    "kitchen-party",
    "kitchen-party",
    null,
    false,
  ],
  [
    "Engagement Promise",
    "engagement-promise",
    "engagement",
    "engagement",
    12000,
    false,
  ],
  [
    "Little Sunshine",
    "little-sunshine",
    "baby-shower",
    "baby-shower",
    null,
    false,
  ],
  [
    "Always Together",
    "always-together",
    "anniversary",
    "anniversary",
    10000,
    false,
  ],
  ["Make a Wish", "make-a-wish", "birthday", "birthday-square", 5000, false],
];
async function main() {
  await db.$transaction(
    async (tx) => {
      const ids = new Map();
      for (const [
        index,
        [name, slug, description, art, icon],
      ] of categories.entries()) {
        const row = await tx.eventCategory.upsert({
          where: { slug },
          update: {},
          create: {
            name,
            slug,
            description,
            imageUrl: `/demo/${art}.svg`,
            icon,
            sortOrder: index,
            isActive: true,
          },
        });
        ids.set(slug, row.id);
      }
      for (const [name, slug, category, art, price, isFeatured] of templates) {
        const orientation =
          art === "graduation"
            ? "LANDSCAPE"
            : art === "birthday-square"
              ? "SQUARE"
              : "PORTRAIT";
        const width = orientation === "LANDSCAPE" ? 1600 : 1080;
        const height =
          orientation === "LANDSCAPE"
            ? 900
            : orientation === "SQUARE"
              ? 1080
              : 1350;
        await tx.template.upsert({
          where: { slug },
          update: { designData: canonicalDesignData(art, width, height), width, height, orientation },
          create: {
            name,
            slug,
            description: `${name} is a locally illustrated demonstration design for the KadiYangu catalog. Explore the style and dimensions; customization will arrive with the card editor in the next phase.`,
            thumbnailUrl: `/demo/${art}.svg`,
            previewImageUrl: `/demo/${art}.svg`,
            categoryId: ids.get(category),
            isPremium: price !== null,
            price,
            currency: "TZS",
            status: "PUBLISHED",
            isFeatured,
            isActive: true,
            orientation,
            width,
            height,
            designData: canonicalDesignData(art, width, height),
          },
        });
      }
    },
    { timeout: 30000 },
  );
  console.log(
    "Development demo data ready: 8 categories, 10 templates. Existing slugs were preserved.",
  );
}
main()
  .catch(() => {
    console.error(
      "Demo seed failed; verify migrations and the local database connection.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
