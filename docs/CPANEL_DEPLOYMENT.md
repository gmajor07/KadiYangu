# cPanel early staging deployment

This is a checklist for the actual hosting account. No host-specific paths, reverse proxy behavior, or Passenger configuration are assumed. A local production build is not evidence that a particular cPanel host supports the app.

## 1. Confirm host capabilities before uploading

- [ ] Node.js Application support/Application Manager is enabled, with long-running Node processes, server logs, and restart controls.
- [ ] Node 22 (at least 22.15.0, preferably latest security patch) or Node 24 LTS is available. `node -v` and `npm -v` in the application environment must match the selected runtime.
- [ ] Host supports a start command (`npm start`) or a CommonJS startup file (`server.cjs`). Confirm how it supplies the listening port or Passenger socket interception. The optional startup entry uses standard `http.Server.listen` and has not been validated against the provider’s Passenger version.
- [ ] PostgreSQL is provisioned or an external PostgreSQL service is reachable; a MySQL-only plan is insufficient. No PostgreSQL superuser or root access is required. Migration user needs DDL rights in the application schema.
- [ ] Outbound database connections and certificate verification work. Use the database provider’s TLS configuration/CA requirements; do not disable TLS verification to work around errors.
- [ ] There is enough RAM/disk/time for npm install, Prisma tooling, and `next build`. Limits vary; validate on this plan. The application uses a pool maximum of three database connections **per Node worker**.
- [ ] A staging subdomain with HTTPS/SSL can route all requests to the Node application, including `/api/auth/*`, `/api/health`, and `/_next/*`.
- [ ] Application files and secrets are outside any directly served document root. Do not put `.env` in a downloadable folder.

## 2. Upload and configure

Create the Node application using the host-provided application-root location. Upload source, `package.json`, `package-lock.json`, `prisma/`, `public/`, configs, and `server.cjs`. Do not upload local `.env`, `node_modules`, or a macOS `.next` build. No Docker, Redis, root, systemd, global package installation, or separate API service is required.

Activate the application's Node environment using the exact command shown by cPanel, then change into its application root. Set these values via the host’s environment interface (or a protected `.env` outside the document root):

| Variable              | Value                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| `NODE_ENV`            | `production`                                                                     |
| `DATABASE_URL`        | Real PostgreSQL connection URL, URL-encoded credentials and required TLS options |
| `AUTH_SECRET`         | Unique random secret; generate with `openssl rand -base64 32`                    |
| `NEXTAUTH_URL`        | Canonical HTTPS staging origin, no trailing path                                 |
| `NEXT_PUBLIC_APP_URL` | Same canonical HTTPS origin; set before building                                 |
| `SITE_INDEXABLE`      | `false`                                                                          |
| `PORT`                | Only if required/provided by the host; do not invent a port mapping              |

This uses Auth.js v4's `NEXTAUTH_URL`; `AUTH_SECRET` is explicitly supplied to its secret option. No `NEXT_PUBLIC_` variable may contain a secret. Next loads `.env` and `.env.local`; Prisma CLI reads `.env`, so keep CLI and process environments consistent. Avoid contradictory values in multiple files.

## 3. Install, migrate, and build

```sh
node -v
npm -v
npm ci --include=dev
npm run db:generate
npm run db:migrate
npm run lint
npm run typecheck
npm test
npm run build
```

`npm ci` is the reproducible lockfile-based equivalent of `npm install`. Do not omit development dependencies before building: TypeScript, Tailwind, and Prisma CLI are needed. Do not use `prisma migrate dev` or `db push` on staging/production. Before subsequent deployments, back up the database and review migrations; migrations are not automatically reversible.

Prisma uses its JavaScript query compiler plus the PostgreSQL adapter at runtime, so runtime query-engine binary targets do not need to be copied from macOS. Prisma CLI migrations may still use a platform-specific schema engine and require a supported Linux/OpenSSL/libc environment and engine-download access. Run install/generate/migrate on the host or a matching supported Linux build environment. Next SWC/Tailwind also have platform-specific packages. Never copy macOS `node_modules` to Linux.

If the host cannot build within memory/process limits, build on a matching Linux environment with the same Node version, public env values, and lockfile, then transfer the complete normal `.next` output, source/configs, `public/`, schema/migrations and dependencies installed for the host platform. This fallback requires its own staging test; static export is not viable for authentication.

## 4. Start and restart

If the host accepts a start command:

```sh
npm start
```

If the panel requires a startup filename, set `server.cjs`, production mode, and the configured environment, then use the panel’s Start/Restart control. For a manual equivalent:

```sh
npm run start:cpanel
```

Use one startup method, not two competing processes. `server.cjs` is an optional standard Next custom-server wrapper, not a guessed Passenger configuration. Do not configure standalone output alongside it. `npm start` should be preferred where supported.

Keep `.next/static` and `public/` in the deployed application tree; Next serves them. A blank or unstyled page often means `/_next/static/*` is blocked or assets were omitted. No external CDN is required. Restart after migrations/build and inspect panel logs without copying credentials or cookies into support tickets.

## 5. Validate the actual staging host

```sh
curl --fail-with-body https://YOUR-STAGING-HOST/api/health
```

- [ ] Expect 200 with app `KadiYangu` and database `connected`.
- [ ] Open `/`, `/about`, `/privacy`, `/terms`, `/login`, `/register`; check CSS and favicon over HTTPS and at mobile widths.
- [ ] Guest `/dashboard` and `/admin` redirect to login.
- [ ] Register a unique test account and sign in; dashboard works. USER cannot view `/admin` (generic unavailable page).
- [ ] Promote only a trusted test account through DB administration; ADMIN can view `/admin`.
- [ ] Suspend the test account in DB; its existing browser session loses protected access immediately. Restore after testing.
- [ ] Logout and verify dashboard no longer opens; wrong passwords and duplicate registration fail safely.
- [ ] Verify session cookies are Secure, HttpOnly, SameSite over HTTPS; confirm redirects keep the staging hostname.
- [ ] Confirm no-index headers and robots policy. Keep staging unindexed.
- [ ] Confirm logs show no recurring startup/Prisma/connection errors. Verify restart persists the application and database.
- [ ] Test database outage in an isolated staging environment: health must return 503 with no internal detail, then recover after restoration.

For repeatable local HTTP smoke checks against an isolated disposable DB, see `scripts/smoke.mjs` and `docs/VALIDATION.md`. Do not run data-mutating smoke tests against a shared or production database.

## Troubleshooting and go/no-go

Node unavailable/too old, MySQL-only hosting with no external PostgreSQL access, blocked native CLI engines, insufficient build memory, or incompatible application startup are deployment blockers. Ask the provider for supported capabilities; do not add undocumented server hacks. If cookies/redirects fail, verify canonical URLs, SSL termination, forwarded host/protocol behavior, and the selected Node app origin. Let the hosting layer handle TLS/HSTS once its HTTPS behavior is verified.

Before enabling public indexing, replace legal drafts, establish support/recovery/verification processes, validate backups and restore, and review the staging rate limits. The next product phase begins only after approval.
