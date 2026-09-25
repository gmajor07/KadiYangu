# KadiYangu — Phase 2

Digital invitation and event platform. Phase 2 adds public celebration discovery, a searchable free/premium template catalog, and administrator category/template management to the existing account foundation. The card editor and event tools are deferred.

See [Phase 2 catalog documentation](docs/PHASE2_CATALOG.md) for routes, pricing rules, local demo seed, administration, and browser tests.

## Stack and prerequisites

- Node.js 22.15.0 was used locally; use the latest patched Node 22 LTS or Node 24 LTS on the host. Supported project ranges are in `package.json`.
- Next.js 16.3.5, App Router, TypeScript 5.9.3, React 19.3.0, Tailwind CSS 4.3.3.
- Prisma Client/CLI/PostgreSQL adapter 6.19.3; node-postgres 8.23.0.
- NextAuth.js (Auth.js project) stable 4.24.15, Credentials provider and encrypted JWT cookies.
- PostgreSQL reachable over TCP, with permission to create schema objects for migrations. PostgreSQL 18 is used in local integration validation.
- npm 10.9.2 is installed locally; npm 11.19.1 was used temporarily for dependency repair after an npm 10 resolver failure. Exact tooling versions and dependency tree: `package.json`, `package-lock.json`.

Prisma 6 is pinned because this workstation’s Node 22.15 predates current Prisma 7 requirements. The `engineType = "client"` adapter architecture avoids Rust query-engine binaries at runtime. Reassess Prisma 7 after upgrading the workstation and staging runtime together. `deepmerge-ts` is overridden to 8.0.0 to address its recursive-object advisory in Prisma CLI tooling; generation and migrations are validated with this override.

## Local setup

```sh
npm ci
cp .env.example .env
openssl rand -base64 32
```

Edit `.env`: set `AUTH_SECRET` to the generated value, configure `DATABASE_URL` for an existing empty PostgreSQL database, and keep both application URLs at `http://localhost:3000`. Do not commit `.env`. No production credentials or shared test credentials are supplied.

```sh
npm run db:generate
npm run db:migrate
npm run dev
```

Visit http://localhost:3000. Register a test account. Registration always assigns `USER` and `ACTIVE`; email ownership is not yet verified. Optional phone numbers are not verified. There is no password recovery in this phase.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm run build` uses Webpack, a standard supported Next build path that avoids depending on Turbopack process behavior on shared hosts. No remote fonts or external asset downloads are needed during builds. Build does not need a live database, but migrations and runtime do. Set all production environment values before building; public URL/indexing values are embedded into generated output.

## Architecture

```text
src/app/(public)/          Home, categories, catalog, detail, about, privacy, terms
src/app/(auth)/            Registration and login; registration server action
src/app/dashboard/        Authenticated server-rendered dashboard
src/app/admin/            Server-authorized category/template management
src/app/api/               Auth.js handlers and database readiness endpoint
src/components/           Reusable layout, form, and UI components
src/lib/auth/             Password hashing, Auth.js configuration, guards, throttling
src/lib/db/               Lazy singleton Prisma client and bounded PostgreSQL pool
src/lib/permissions/      Active-user and admin policy
src/lib/validation/       Zod input schemas
src/services/             Registration service with explicit allowed fields
src/config/               Site metadata and future payment-provider vocabulary
src/types/                Session typing
prisma/                   Schema and versioned initial SQL migration
public/                   Static assets
scripts/                  Repeatable staging smoke checks
```

Authorization sits in server-side guards and is called directly by each protected page. Future protected actions/handlers must call the guards themselves; a layout or hidden navigation is not authorization. No edge middleware or separate backend is needed. Database errors fail closed.

## Database and authentication

`User`: id, name, unique normalized email, optional phone, scrypt password hash, USER/ADMIN role, ACTIVE/SUSPENDED status, nullable emailVerified, createdAt and updatedAt.

`AuthRateLimit`: hashed scope/identity, attempt count, expiry. This small operational model supports atomic throttling shared by all workers. Phase 2 additionally has EventCategory and Template models; see the catalog documentation. Payments are only a TypeScript provider list (`MIXx_BY_YAS`, `MPESA`, `AIRTEL_MONEY`, `CARD`, `OTHER`); there are no payment tables or secrets.

Credentials are checked server-side with Node scrypt (N=32768, r=8, p=3), random salts, and timing-safe comparison. Unknown accounts perform the same password derivation. JWT sessions last eight hours. Protected requests re-read the user so suspension, deletion, and role changes apply to existing sessions. Auth.js protects login/logout using CSRF tokens; registration uses Next Server Actions’ POST/origin validation. Passwords and database modules are server-only. Inputs are bounded and allowlisted; registration cannot assign roles or statuses. Duplicate registration uses the same response as successful registration.

Login limits: 10 attempts per normalized email and 300 total per 15-minute window. Registration limits: 5 per email and 50 total per window. Limits are intentionally conservative for staging; global limits mean one abusive source can consume shared capacity. They do not replace a host’s volumetric abuse protections. No untrusted forwarded IP is treated as an identity. Remove expired limiter rows periodically with trusted DB maintenance:

```sql
DELETE FROM "AuthRateLimit" WHERE "expiresAt" < NOW();
```

After registering an administrator’s own account, a trusted database operator may promote that specific account using a parameterized database tool, or the following SQL with the actual normalized email substituted deliberately:

```sql
UPDATE "User" SET "role" = 'ADMIN', "updatedAt" = NOW()
WHERE "email" = 'your-admin@example.com' AND "status" = 'ACTIVE';
```

Never expose this operation through public registration. No default administrator exists. Logout clears this browser’s cookie; global logout/revocation of a stolen JWT and password reset are not implemented.

## Staging deployment and health

Follow [the cPanel deployment checklist](docs/CPANEL_DEPLOYMENT.md). Standard `next start` is primary; `server.cjs` supports panels requiring a startup filename. Standalone output is intentionally disabled: unknown Passenger/startup-file requirements should be tested first, and a normal Next build keeps public assets and dependencies explicit.

`GET /api/health`: HTTP 200 with `{ "status": "ok", "app": "KadiYangu", "database": "connected" }`; HTTP 503 and a generic unavailable status if DB connectivity fails. Responses are not cached. This is a connectivity check, not a schema or full authentication test; run migrations and account smoke tests too.

## Scope and release limits

Functional public pages, account registration/login/logout, dashboard, admin protection, security headers, health check, metadata/robots/sitemap, migrations, tests, deployment docs. Indexing is off by default, including an X-Robots-Tag response header. Robots rules are not an access control mechanism. Restrict staging access with host facilities if needed.

Privacy/terms are explicitly staging drafts. Before public launch, establish operator/support details, applicable privacy terms and retention processes, email verification/recovery, and an abuse policy. Live cPanel compatibility remains unverified until tested on the actual host. No claim of real hosting deployment is made by local checks.

Deferred: card editor, canvas, invitation pages, events, guests, RSVP, QR, WhatsApp/social sharing, all purchase/order/payment workflows and mobile-money gateways, subscriptions, AdSense, analytics, AI imagery, marketplace, and full administration. Do not start Phase 3 automatically.

References: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Auth.js Credentials sessions](https://next-auth.js.org/configuration/providers/credentials).
