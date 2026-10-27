# QR-first gate scanner audit and verification

## Existing QR contracts

Guest Management's former “View QR” calls QRCode.toDataURL on the personalized
invitation URL `/i/<event-slug>/g/<Guest.invitationCode>`. Invitation codes use
24 random bytes (base64url). This QR is an invitation/RSVP link and has never been
an entry-pass credential. The control now says “View invitation QR” and explains
that distinction without changing its payload.

Entry passes use 32 random bytes (43 base64url characters). Only a SHA-256 hash
is stored in GuestPass.tokenHash; the raw token is returned once during issuance
or replacement. Paid QRDelivery renders these raw tokens into downloadable ZIP
PNG files held in browser memory. Replace QR rotates the hash and offers a new
PNG; it invalidates the old QR without increasing capacity. Beta issuance currently
returns raw tokens to a server action that does not deliver them to the UI. The
existing beta dashboard instructs organizers to use replacement PNGs. That delivery
gap is outside the scanner change; invitation QR must not be substituted for it.

checkInGuestPass performs verification AND a real attendance write. It authorizes
the event owner or a user explicitly assigned in EventStaff. Organization membership
alone did not grant check-in access and still does not. The scanner picker, selected
event lookup and check-in transaction now share this exact predicate.

Check-in takes the same PostgreSQL advisory lock as QR replacement, reloads by
hash, validates event and status, conditionally transitions ACTIVE -> CHECKED_IN,
and inserts CheckIn(result=APPROVED) in the same transaction. Repeated scans do
not insert another CheckIn. Revoked and wrong-event passes are rejected. The
internal legacy wrong-event reason stays INVALID for compatibility; the HTTP
endpoint exposes WRONG_EVENT without disclosing another event or guest.

One pass admits ONE person. There is no multi-entry counter on GuestPass, and
Guest.maxGuests/plusOneAllowed are RSVP data, not additional pass capacity. The
scanner shows allowed=1, checked-in=1, remaining=0 only from an authorized verified
pass result. A group needs separately issued passes. No capacity model changed.

## Camera root causes

1. next.config.ts sent Permissions-Policy `camera=()` for every route, prohibiting
   camera access even if the user wanted to grant it. The document policy now allows
   only same-origin camera access, camera=(self). A scanner-route-only override
   would still fail after Next client navigation from a dashboard because document
   policies do not update with RSC navigation. Microphone remains disabled.
2. The old scanner rendered its video element only after setting camera=true,
   while startCamera required that video ref to exist before setting camera=true.
   getUserMedia could acquire a stream but never attach/show it.
3. Detection relied exclusively on the non-universal native BarcodeDetector.
4. An interval captured stale React busy state; repeated starts could leak streams,
   initialization errors were all mislabeled as permission denial, and event query
   selection was ignored.

The new preview is a permanently mounted video element backed by a real MediaStream.
A user clicks Start camera to request permission. QR decoding uses locally bundled
@zxing/browser 0.1.5 / @zxing/library 0.21.3, compatible with project Node 22. These
versions are pinned together to satisfy peer requirements (newer core needs Node 24).
API usage was checked against https://github.com/zxing-js/browser and installed
type declarations. No remote decoder worker/CDN or fake preview is in production.

A session owns pending getUserMedia requests, stream, decoder controls and cleanup.
Rear-facing ideal constraints are preferred; unavailable default constraints fall
back to any camera. After permission, desktop users can choose a labeled camera.
Permission denial, no device, device busy/disconnected, insecure context and
unsupported browser states have guidance and retry controls. Stop, hidden document,
component unmount and late permission resolutions release tracks. The client pauses
verification after a result until “Scan next guest”; a synchronous lock and cooldown
also suppress concurrent/repeated decoder callbacks. Tokens are not rendered/logged.

## New workflow

/dashboard/scanner?event=<id> authenticates, authorizes and resolves the event on
the server, displaying its title. Invalid/unauthorized/duplicate event parameters
are rejected. Without a selected event, the page offers an owner/staff event picker.
There is no editable raw event-ID field.

Open selected event -> Start camera -> scan entry QR -> online POST to the existing
check-in endpoint -> approved/already-used/invalid/wrong-event/revoked result.
Invitation URLs are never followed or transformed into credentials. The server
independently validates token structure, authentication, active account and event
permissions. Response data excludes raw token hashes and database pass IDs.
An optional password-masked manual fallback is inside a collapsed disclosure.
No offline approval is possible. A timed-out request can have committed: rescan to
learn whether the pass is already used; never infer success from a network error.

## Test safety and local commands

No production/Railway access, deployment, SMS/WhatsApp, destructive migration or
attendance change is required. No application schema migration was introduced.
Provisioning only creates an empty `kadiyangu_scanner_test` on loopback PostgreSQL
and pushes schema into it. Existing non-empty test databases are not reset or
schema-modified. Fixtures have unique IDs and cleanup deletes only their rows.

```sh
npm run typecheck
npx vitest run tests/scanner.test.ts tests/scanner-check-in.test.ts
node scripts/prepare-scanner-test-db.cjs
node scripts/with-scanner-test-db.cjs npx vitest run tests/scanner-security.integration.test.ts
npm test -- --maxWorkers=2
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/with-scanner-test-db.cjs npx playwright test --config playwright.scanner.config.ts
```

The Playwright config uses a separate headless Chrome profile and virtual cameras,
not the user's normal browser profile, accounts or physical webcam. One test exercises
real browser getUserMedia with a virtual device; others use canvas MediaStreams with
QR images through a real video element and ZXing decoder plus the isolated check-in
API. These are browser/decoder tests, not proof of physical-camera operation.

A physical rear-camera test over the deployed HTTPS origin on supported iOS/Android
and a desktop webcam test remain required. Do not claim hardware-camera scanning
is verified until those manual tests are completed.

## Files changed

- next.config.ts: same-origin document camera policy (including dashboard-to-scanner
  client navigation) and scanner privacy headers.
- package.json / package-lock.json: pinned ZXing browser/core dependencies.
- src/services/scanner.ts: shared check-in event access and server selection.
- src/services/guest-passes-qr.ts: same locked check-in transaction, strict existing
  token validation and authorized one-entry display metadata.
- src/app/api/events/[eventId]/check-in/route.ts: session/account checks, safe JSON
  responses, wrong-event result, no-store and cross-origin request rejection.
- src/app/dashboard/scanner/page.tsx: server event resolution/picker.
- src/components/scanner/gate-scanner.tsx: mobile camera-first UI and verification.
- src/lib/scanner/camera.ts: stream/decoder lifecycle and camera errors.
- src/lib/scanner/contracts.ts: entry payload parsing, result text and scan throttle.
- src/components/events/guest-invitation-actions.tsx: clearer invitation QR labeling.
- scripts/prepare-scanner-test-db.cjs / scripts/with-scanner-test-db.cjs: safe local
  test provisioning and commands without modifying .env.
- playwright.scanner.config.ts / tests/scanner-browser/scanner.spec.ts: isolated
  real-browser tests with virtual input only.
- tests/scanner.test.ts / tests/scanner-check-in.test.ts / tests/scanner-api.test.ts:
  camera, selection, QR, authorization, HTTP boundary and transaction unit tests.
- tests/scanner-fixture.ts / tests/scanner-security.integration.test.ts: local-only
  PostgreSQL concurrent duplicate, authorization, wrong-event and capacity tests.
- docs/gate-scanner.md: this audit, contracts and verification report.

## Final verification

- Scanner unit/API tests: 23 passed.
- Isolated PostgreSQL security/concurrency/capacity tests: 2 passed, with fixture cleanup.
- Full regression: 192 passed, 32 skipped, 2 failed (unchanged qr-zip.test.ts
  173/207 PNG cases exceeded 30-second timeouts). Full regression is not green.
- Final production build: passed, including Prisma generation, TypeScript and
  standalone packaging (all 23 existing migration directories included).
- Changed scanner source/test files: ESLint passed; the pre-existing generated-QR
  img in guest-invitation-actions.tsx retains its no-img-element warning.
- All 8 browser scenarios passed across final verification runs: server event
  resolution, real browser getUserMedia with a virtual device after dashboard client
  navigation, synthetic QR -> video -> ZXing -> real isolated check-in API, denied
  permission, no camera, invitation QR rejection, wrong-event/concurrent duplicate
  API calls, and unsupported-browser manual fallback. The QR pipeline test also
  checked Stop and navigation stream cleanup, duplicate suppression and used-pass
  feedback. The final runs had 3 initial scenarios passed, followed by 5 remaining
  scenarios passed after a test-only locator fix for Next's route announcer.
- Earlier browser attempts encountered test URL mismatch and Chrome page-creation
  timeouts. The isolated runner now sets both URL variables plus the project's
  existing ALLOW_TEST_DATABASE startup flag; test database guards remain exact.
  Chrome uses a 120-second test budget and disabled GPU in this environment.
- No physical camera was tested. Virtual-camera browser verification must not be
  represented as iOS/Android rear-camera or desktop webcam hardware certification.
- No app schema migration, production environment modification, Railway access,
  deployment, production attendance changes, SMS or WhatsApp sending occurred.
