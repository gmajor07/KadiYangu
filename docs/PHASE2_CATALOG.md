# Phase 2 — Public discovery and invitation catalog

Phase 2 extends the existing Next.js application. Authentication, User/ADMIN roles, scrypt, session guards, account suspension, and the Phase 1 migrations remain intact. No cPanel deployment was attempted, and no Phase 3 editor was implemented.

## Routes and behavior

| Route                         | Behavior                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/`                           | Commercial public homepage, active DB categories, published featured templates, honest future-feature sections |
| `/categories`                 | All active database-backed celebration categories                                                              |
| `/templates`                  | Search by name; category, Free/Premium and orientation filters; 12 results/page; empty/loading states          |
| `/templates/category/[slug]`  | Active category description, category-specific catalog and filters                                             |
| `/template/[slug]`            | Public preview, price, category, orientation and dimensions; disabled editor CTA with explanation              |
| `/admin`                      | Catalog management entry points; ADMIN only                                                                    |
| `/admin/categories`           | Paginated category list                                                                                        |
| `/admin/categories/new`       | Add category                                                                                                   |
| `/admin/categories/[id]/edit` | Edit name, slug, description, image, icon, order and active state                                              |
| `/admin/templates`            | Paginated template list including hidden/draft/archived records                                                |
| `/admin/templates/new`        | Create template and initialize basic design JSON                                                               |
| `/admin/templates/[id]/edit`  | Update category, price, publication status, active/featured flags, dimensions and local previews               |

Create Invitation starts at template discovery. Customize on a catalog card opens its detail page. The detail’s “Customize This Template” button is deliberately disabled and explains that the editor comes next. No card customization, export, events, RSVP, QR generation, sharing or purchasing is implied to be functional.

The catalog requires PostgreSQL at runtime. Empty databases render honest empty states; they do not rely on demo seeding. A database outage is handled by the existing safe error boundary, not disguised as an empty catalog.

## Schema and migration

`20260921000100_phase2_template_catalog` adds `EventCategory`, `Template`, `TemplateStatus` and `TemplateOrientation`, with indexes and a restrictive category foreign key. It does not alter or remove User/AuthRateLimit or the Phase 1 migration.

EventCategory has the requested descriptive fields, unique slug, local image path, optional text symbol, sort order and active flag. Template belongs to one category and adds unique slug, description, local image paths, status, active/featured flags, orientation, dimensions, pricing and Prisma `Json` design data.

Public visibility always requires all three conditions: **PUBLISHED template + active template + active category**. The same rule is shared by listings, detail lookup, featured designs and sitemap. Deactivating a category hides its templates without altering or deleting them. React memoization is request-scoped; public catalog routes are dynamically rendered to reflect admin changes.

Prices are PostgreSQL integers in **whole currency units**: `15000` means **TZS 15,000**. FREE always has `isPremium=false` and `price=null`. PREMIUM requires `isPremium=true` and a positive integer (maximum 2,147,483,647). `currency` is a separate three-letter code, currently validated to TZS in the UI/service. No floating-point prices are stored. Adding fractional currencies later must define units and an explicit conversion/migration rather than reinterpreting saved TZS values.

Database CHECK constraints enforce price, currency-code shape and orientation/dimension consistency in addition to server validation. Canvas sizes range from 320 to 8000 pixels. New design documents contain `{ version: 1, canvas: { width, height }, elements: [] }`. Admin is not asked to edit JSON. Edits preserve existing elements and other document keys while synchronizing canvas dimensions.

## Security and assets

- Each admin page calls the existing server guard before reading records; mutation services call it again before validation or DB access. A hidden button or layout is not the security boundary.
- Server Actions keep Next’s origin checks; submitted fields are explicitly allowlisted. Zod rejects unknown mutation fields, malformed slugs, invalid prices and mismatched dimensions.
- Unique indexes handle concurrent duplicate slugs. Expected write errors become safe form messages; internal exceptions and credentials are not returned.
- Descriptions are rendered as escaped text; there is no raw HTML or design JSON editor.
- Phase 2 permits local `/images/` and `/demo/` paths only. Protocols, remote URLs, query strings, percent encoding and path traversal are rejected. Assets can be SVG, PNG, JPEG, WebP or AVIF. Missing images fall back to a bundled placeholder.
- No server-side remote-image fetching, uploads, binary DB storage, Cloudinary or S3 integration is added. The shared image validation/component boundary can gain a vetted storage allowlist later.
- Admin/auth pages never mount AdSlot. Public listing/category/detail slots currently render nothing and have no AdSense credentials or scripts.

SEO includes canonical URLs and Open Graph text metadata. Filtered/paginated catalog pages are noindex, with canonical links to their base listing. `SITE_INDEXABLE=false` remains the default and keeps robots/meta/headers unindexed and the sitemap empty. When explicitly enabled later, sitemap includes active categories and publicly visible designs (bounded below 50,000 entries; split sitemaps before exceeding that scale). SVG demo previews are not claimed as social-network-compatible OG images; supported raster previews will populate OG images.

## Local run commands

Keep the existing `.env`; do not overwrite it. With Node and the existing PostgreSQL database available:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
# Optional, local development only:
ALLOW_DEMO_SEED=true npm run db:seed
npm run dev
```

Open http://localhost:3000. If the existing `.env` uses another canonical origin, run on that configured origin.

Production build commands remain `npm run build` and `npm start` (or the existing startup-file wrapper). Do not run demo seeding during deployment.

## Demo data

The explicit local-only seed adds the requested 8 categories and 10 templates. Existing records with matching slugs are preserved, so rerunning it does not undo admin edits. The script refuses production mode, remote databases and missing `ALLOW_DEMO_SEED=true` confirmation.

| Template                | Category      | Tier / whole TZS | Format    |
| ----------------------- | ------------- | ---------------- | --------- |
| Royal Gold Wedding      | Wedding       | PREMIUM 15,000   | Portrait  |
| Elegant Floral Wedding  | Wedding       | FREE             | Portrait  |
| Modern Birthday         | Birthday      | FREE             | Portrait  |
| Graduation Classic      | Graduation    | PREMIUM 8,000    | Landscape |
| Send-off Celebration    | Send-off      | PREMIUM 10,000   | Portrait  |
| Kitchen Party Botanical | Kitchen Party | FREE             | Portrait  |
| Engagement Promise      | Engagement    | PREMIUM 12,000   | Portrait  |
| Little Sunshine         | Baby Shower   | FREE             | Portrait  |
| Always Together         | Anniversary   | PREMIUM 10,000   | Portrait  |
| Make a Wish             | Birthday      | PREMIUM 5,000    | Square    |

Illustrations are local, code-authored SVG demo previews, visibly marked as demo designs. They are not full editor documents. No AI image generation was used.

## Verification commands

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Provision a separate local PostgreSQL database named `kadiyangu_phase1_test` accessible with your development DB user. The following runner derives its local connection from `.env` and changes only the database name, protecting the main development database from test mutations:

```sh
node scripts/with-test-db.cjs npm run db:migrate
ALLOW_DEMO_SEED=true node scripts/with-test-db.cjs npm run db:seed
node scripts/with-test-db.cjs npm run test:integration
npx playwright install chromium
node scripts/with-test-db.cjs npm run build
node scripts/with-test-db.cjs npm run test:e2e
```

Browser tests start their own production server on port 3102. The test runner sets KADI_TEST_BUILD=true, which selects an ignored .next-test build directory. Build through that runner first so the compiled public URL matches the test server. The normal .next build and .env are preserved. Leave the test port available. `TEST_PORT` can select another port. If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable instead of installing a browser. Test users and browser-created catalog records are removed after the run. Do not run these tests against production or a shared test database with valuable data.

Screenshots are saved under `docs/screenshots/phase2/`. Manually inspect `/`, `/templates`, `/templates?tier=free`, `/templates/category/wedding`, `/template/royal-gold-wedding`, `/admin/categories`, and `/admin/templates/new` on your own phone too. Admin screenshots require no real credentials; automated checks use a disposable admin in the test database. No permanent/default admin account is created.

## Hosting and scope

Only Playwright browser tooling was added as a development dependency. No runtime infrastructure requirement changed: same Node, PostgreSQL, Prisma adapter and standard Next server. Browser installation is for testing, not production hosting. No Docker, Redis, worker, systemd, payment API or reverse-proxy requirement was introduced.

The existing staging privacy/terms and Phase 1 email verification/recovery limitations remain. Real template artwork/licensing and any future production prices need product review. Phase 3 still requires a separately approved editor specification.
