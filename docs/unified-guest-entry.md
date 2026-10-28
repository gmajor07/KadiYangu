# Unified personalized invitation and entry passes

## Audit: identity is not entitlement

- `/i/[slug]` is a published public invitation with anonymous RSVP. It has no guest
  identity and never renders My Entry Pass or any guest credential.
- `/i/[slug]/g/[invitationCode]` identifies a Guest using the existing high-entropy
  personal invitation code (18 random bytes for manual creation, 24 for imports).
  Possession of this personal link is the existing guest identity mechanism. Treat
  it as private; it now also permits retrieval of explicitly allocated guest passes.
- RSVP records attendance intent and party size. It does not purchase, issue or
  allocate entry passes. Public RSVP updates now exclude all guest-linked RSVP rows.
- Legacy GuestPass assignment stored a name/contact snapshot only, with no guest FK.
  Its raw random 32-byte base64url token was returned once; only SHA-256 was stored.
  It is impossible to recover that raw token from its hash. Names/contacts are not
  reliable proof of guest identity and are not used for automatic migration.
- Existing issued passes, paid purchase inventory and beta grants remain the only
  source of entry capacity. Each QR admits exactly one person. A party requires one
  separately allocated pass per person, within RSVP count, maxGuests and plus-one rules.

## New flow and organizer allocation

The personal invitation has Invitation / RSVP / My Entry Pass navigation. RSVP is
available there even if an event's public section configuration hides it. Guest sees
an actual status and next step: RSVP first, declined, not allocated, revoked, used,
outside current party limit, inactive backing purchase or secure retrieval unavailable.

Guest Management exposes distinct Copy Invitation Link, View Invitation QR and
View Entry Pass actions. Each guest has a pass-status summary and an explicit
allocation form. Allocation requires attending RSVP and a published event. It binds
already-issued ACTIVE passes backed by ISSUED/BETA_ISSUED inventory; it does not mint
passes or change purchase counters. If inventory is missing, Manage Entry Passes is
the next step to issue already-purchased/beta capacity through existing infrastructure.

Automatic selection uses only unnamed, unlinked passes. Organizers can explicitly
select a legacy pass, including its previous name snapshot, to bind it to a real
guest. The required confirmation explains that this invalidates that pass's previous
QR. This deliberate rotation prevents an old shared generic QR remaining usable
alongside the newly private guest-access flow. No name/email/phone guessing occurs.

Allocation serializes by guest and event inventory, uses purchase and pass locks,
and enforces unique guest/slot pairs. Repeated/concurrent requests return the existing
allocation without regeneration. Revoked and checked-in slots are never auto-reissued.
Paid issuance now also atomically claims purchase remaining capacity under its shared
purchase lock, preventing concurrent issuance from overselling the same entitlement.

## Same QR on reopening, without a second QR protocol

New optional GuestPass fields: guestId, guestSlot, tokenEnvelope. Composite guest/event
FK prevents cross-event assignment; a unique guest/slot pair prevents duplicate
entitlement. Existing rows remain unlinked, with no name-based backfill.

Raw tokens remain random 32-byte base64url values (43 characters). QR payload and
scanner protocol are unchanged. To make authorized retrieval possible, allocated
passes store an AES-256-GCM encrypted token alongside the existing hash. AAD binds the
ciphertext to pass ID, event ID and replacement revision. Successful decryption also
requires the plaintext's SHA-256 to equal tokenHash. Reopening does not generate,
rotate or allocate a token. Replacement deliberately changes both hash and encrypted
payload while retaining the guest/slot binding; the old QR immediately stops working.

The server derives a separate storage key with HKDF from ENTRY_PASS_ENCRYPTION_KEY,
or AUTH_SECRET when the dedicated key is empty. A real server-only secret of at least
32 characters is required. Never change the selected key casually: existing ciphertext
will become unreadable and requires controlled pass replacement. Existing downloaded
QRs continue to be hash-verified until revoked/replaced. The optional dedicated key
allows auth-secret rotation without changing the pass storage secret.

Only private guest-code or authorized-organizer endpoints return QR PNGs. Raw tokens,
encrypted envelopes and hashes are not passed in page props or JSON to public visitors.
Endpoints and personalized documents use private/no-store, no-referrer and noindex
headers. The client fetches QR images only on Show Pass / Save QR, bypasses image
optimization caches and revokes temporary blob URLs. Guest names, event names and
single-person allowed counts are displayed with the QR. Save revalidates entitlement.

## Gate safety

Invitation QR remains a URL and is never accepted as an entry token. The scanner says:
“This is an invitation link, not an entry pass. Ask the guest to open their invitation
and select My Entry Pass.” Gate staff scans the QR displayed by that action.

The existing owner/EventStaff authorization, token-hash lookup, replacement advisory
lock, conditional ACTIVE -> CHECKED_IN update and CheckIn insertion remain in use.
Guest-bound passes additionally revalidate published event, current attending RSVP,
party slot and active backing purchase. Declining RSVP blocks retrieval and admission
of an unused allocated QR, including previously saved copies. RSVP cannot be declined
or reduced below a party slot already checked in. Legacy unlinked passes retain their
existing verification behavior; linking them is explicit and rotates the credential.

## Migration and local verification

`20261027140000_guest_entry_pass_retrieval` is additive: nullable columns, indexes,
composite FK and a valid-slot CHECK. No DROP, DELETE, reset or identity backfill.
It must be applied before this feature is used in any approved environment. Nothing
is deployed and no production database is used by these test commands.

The existing isolated scanner database is used for integration/browser fixtures.
For an existing pre-feature test schema, apply ONLY this additive migration:

```sh
node scripts/with-scanner-test-db.cjs npx prisma db execute --file prisma/migrations/20261027140000_guest_entry_pass_retrieval/migration.sql --schema prisma/schema.prisma
npx prisma generate
npx vitest run tests/entry-pass-crypto.test.ts tests/scanner.test.ts tests/scanner-check-in.test.ts tests/scanner-api.test.ts
node scripts/with-scanner-test-db.cjs npx vitest run tests/guest-entry.integration.test.ts tests/scanner-security.integration.test.ts
node scripts/with-scanner-test-db.cjs npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/with-scanner-test-db.cjs npx playwright test --config playwright.scanner.config.ts guest-to-gate.spec.ts
```

Build uses a test-only local public origin so copied invitation links target the
isolated server, not an unrelated running development app. No .env values are modified.
Browser tests use anonymous guest and separate authenticated organizer/staff contexts.
They download the real private PNG, decode its token, feed that QR through the existing
virtual-camera video/ZXing scanner, and assert the real isolated CheckIn transaction.
This verifies guest-to-gate software flow, not physical camera hardware or deployment.

## Files

- prisma/schema.prisma and the additive guest-entry migration.
- src/lib/entry-pass-crypto.ts, guest-entry-policy.ts, entry-pass-response.ts.
- src/services/guest-entry-passes.ts; existing guest-passes-qr.ts, events.ts, guests.ts.
- Personalized invitation route, public-website.tsx and entry-pass-panel.tsx.
- Guest Management page/actions and authenticated organizer entry-pass page.
- Private invitation/organizer PNG endpoints; event-scoped QR replacement endpoint.
- Existing scanner feedback/UI, pass-management guidance, next.config.ts privacy headers.
- .env.example; entry-pass crypto tests, isolated entitlement tests and guest-to-gate
  browser tests. No production environment file was edited.

## Verified result

- Relevant unit/crypto/scanner/API/legacy tests: 43 passed.
- Isolated PostgreSQL entitlement, capacity, replacement and scanner tests: 9 passed.
- Browser guest-to-gate scenarios: 2 passed. The positive scenario used the actual
  organizer invitation QR URL, anonymous guest RSVP, explicit organizer allocation,
  actual saved private PNG, repeated secure retrieval of the same token, real video
  plus ZXing decoding with virtual camera input, one recorded admission and duplicate
  rejection. The negative scenario confirmed declined/public/unauthorized access.
- TypeScript, Prisma generation, production build and standalone packaging passed.
- Changed new files passed ESLint and git diff --check.
- The additive migration was applied to the isolated local test database and the
  guarded localhost development kadiyangu database only. Other pending migrations
  were not applied. Helper: scripts/apply-local-guest-entry-migration.cjs.
- No production attendance/data, Railway access, deployment or SMS/WhatsApp sending.

Physical camera hardware and production deployment were not tested. This verifies
software guest-to-gate flow on localhost. Reopening depends on keeping the selected
storage secret stable and the guest's bearer invitation private. Legacy passes need
explicit linking (which rotates their old QR); revoked slots stay revoked and never
get an automatic replacement entitlement. Restart a running development server after
Prisma Client/schema changes if its cached client predates this migration.
