# Phase 1 validation

## Repeatable checks

```sh
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

Unit tests cover password hashing, registration validation/mass assignment rejection, active-role permissions, actual server guards, deleted/suspended users, and healthy/unavailable database responses.

The integration test runs the registration service and concurrent throttle queries against PostgreSQL, including duplicate handling and persisted password verification. It requires a deliberately named, disposable database; never point it at production. Provision an empty database named `kadiyangu_phase1_test`, then:

```sh
export DATABASE_URL='postgresql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/kadiyangu_phase1_test'
export ALLOW_TEST_DATABASE=true
npm run db:migrate
npm run test:integration
```

Set a random `AUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, and run `npm start` in a separate terminal with the same test database URL. Then:

```sh
npm run test:smoke
```

The HTTP smoke check creates and removes one test account. It checks public routes, live DB readiness, unauthenticated redirects, wrong-password rejection, successful credential login, session cookies, ordinary-user admin denial, administrator access after role promotion, suspension with an existing session, and logout. Throttle test rows may remain in this disposable DB; remove the test DB when done. It does not delete or reset other users.

Use `SMOKE_URL=http://localhost:3001` to test the optional startup-file server on another port. The script restricts its target to localhost and the explicitly named test database. Tests cannot establish compatibility with an unknown cPanel provider.

## Initial issues addressed

Initial lint found CommonJS-entry and client-navigation issues. The entry is explicitly scoped as CommonJS; navigation uses the Next router. A health-test cleanup callback accidentally returned a mock and was corrected. Initial dependency audit found Prisma CLI `deepmerge-ts` and old Vitest advisories; dependency versions/override were updated and all checks must be rerun after that repair.

## Final results (2026-09-19)

- Dependency install: passed using npm 11.19.1 after npm 10.9.2’s dependency resolver crashed during the Vitest upgrade. Full install audit: zero vulnerabilities.
- Prisma Client generation 6.19.3: passed with the patched deepmerge-ts override.
- Initial migration: applied successfully to isolated PostgreSQL 18.
- ESLint: passed, no source warnings/errors.
- TypeScript: passed.
- Unit tests: 13 passed across 3 files.
- PostgreSQL integration: 1 passed, including registration, duplicate handling, safe role defaults, password verification, and concurrent rate limits.

Tooling caveats: npm reports ESLint 9.39.5 deprecated; it is development-only. Vite warns that the current TypeScript config module style will need adjustment before a future native-config default. These are warnings, not suppressed test failures.


- Final production build: passed with Next.js 16.3.5; all requested routes built, including dynamic auth/health/dashboard/admin routes.
- npm 10.9.2 `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: passed against the repaired lockfile. This was a dry run, not another full clean installation.
- Production HTTP smoke under `next start`: passed all listed authentication and authorization scenarios.
- Production HTTP smoke under `server.cjs`: passed the same scenarios, plus built stylesheet delivery and no-index response headers.
- Real database outage: after stopping the isolated PostgreSQL server, the running startup-file server returned HTTP 503 with exactly `{ "status": "degraded", "app": "KadiYangu", "database": "unavailable" }`.
- Temporary test database server and both application servers were stopped after validation. No actual hosting account was deployed to.

The initial directory was empty and not a Git repository. No unrelated files were overwritten. The test cluster and a dependency-repair backup were created under `/tmp`; no real database credentials or persistent application secrets were written into the project. Browser-driven layout/accessibility tests, actual cPanel/Passenger integration, TLS cookies behind the host’s proxy, and database recovery after an outage still require staging validation.
