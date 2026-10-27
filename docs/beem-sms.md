# Phase 7E.4 — PREPARED, NOT LIVE

## Audit and scope

Reuses MessageTemplate, MessageCampaign, MessageRecipient, MessageConsent,
MessageLog, AuditLog, event authorization and the existing template/preview forms.
The prior uncommitted implementation had an executable Beem fetch and a live-send
button enabled by credentials alone. Both have been removed. The legacy send action
now always refuses live dispatch. No worker, cron, webhook or deployment is enabled.

Templates support existing placeholders. Campaigns start DRAFT, become READY only
with a template and eligible saved recipients, and can be CANCELLED from DRAFT or
READY. Queue/worker predicates require READY and SMS. Cancellation prevents any
further mock claim; it does not erase queue history. Existing delivery status values
are preserved; no destructive rewrite or backfill is included.

## Verified official contracts (2026-10-26)

- https://docs.beem.africa/api-reference/send-sms
- https://docs.beem.africa/guides/sms/api-responses
- https://docs.beem.africa/guides/sms/delivery-reports

Send: POST https://apisms.beem.africa/v1/send with Basic auth (API key/secret),
source_addr, encoding=0, message and recipients [{recipient_id: 1, dest_addr}].
One recipient per personalized request. Destination has international digits and
no leading +. Sender must be active; alphanumeric sender maximum is 11 characters.
Code 100, successful=true, valid=1 and request_id indicate acceptance, not delivery.
The adapter uses pure preparation/normalization functions: no transport is executed.

Delivery: GET https://dlrapi.beem.africa/public/v1/delivery-reports with dest_addr
and request_id; wait at least five minutes after submission. Only documented DLR
values PENDING, DELIVERED, UNDELIVERED map to SENT, DELIVERED, FAILED respectively.
Reports must match both identifiers. No delivery polling or ingestion is enabled.
Only default GSM encoding is prepared; Unicode encoding must be confirmed before
supporting non-GSM content in live mode.

## Configuration and safety

Only .env.example changed; existing .env/production variables were not modified.

BEEM_API_KEY, BEEM_API_SECRET, BEEM_SENDER_ID configure the prepared adapter.
BEEM_SENDER_APPROVED defaults false and records explicit operator confirmation;
it does not query Beem or prove registration approval. Sender approval is pending.
SMS_DISPATCH_MODE defaults disabled. SMS_MOCK_DISPATCH_ENABLED defaults false.
Both mode=mock and enabled=true are required for the server-only mock worker.
Credentials alone never enable either mode. Live adapter is locked in code and
returns a configuration refusal regardless of environment variables. No live HTTP
client exists in this phase. No network calls to Beem were made by implementation
or tests; only official documentation was read.

## Queue and retry

MessageRecipient doubles as the job, avoiding a duplicate queue model. Existing
unique(campaignId,destination), nullable unique smsIdempotencyKey and atomic
conditional updates prevent duplicate jobs/claims. Job keys are mock:<recipientId>.
Queue preparation processes up to 100 candidates; repeat preparation for more.
Only NOT_SENT/NONE records are accepted, preventing replay of old sent/uncertain
recipients. Pending mock jobs use delivery status QUEUED. Mock acceptance produces
COMPLETE with a mock request ID, never real SENT or DELIVERED.

Job states: NONE -> PENDING -> PROCESSING -> COMPLETE | RETRY_WAIT | FAILED |
UNCERTAIN. Due RETRY_WAIT jobs can be claimed again. Attempts are capped at three,
with deterministic backoff of 60 and 120 seconds. Only explicit TRANSIENT rejection
is retryable. Configuration and permanent rejections stop. Ambiguous timeouts,
code 103, 5xx, malformed responses and thrown provider errors become UNCERTAIN
without automatic retry. An explicit non-acceptance rate-limit response can be
classified transient; never infer rejection solely from an ambiguous HTTP status.

Preparation and each mock execution use Serializable database transactions.
The claim requires due time, attempt budget, MOCK mode and a READY SMS campaign.
Claim, mock execution, result, MessageLog and AuditLog commit together. A dead
process rolls back; there is no external side effect and no stale-lock replay.
Serialization conflicts return a safe retry-later result rather than duplicating
a submission. Future real network I/O must NOT be placed inside this transaction;
it requires a reviewed outbox/lease/reconciliation design first.

## Consent and permissions

Event ownership/organization roles are checked before queue preparation and each
mock execution. Consent and contacts are reloaded at queue and dispatch time.
Only SMS consent rows are considered for SMS. OPTED_OUT and UNKNOWN (including
missing consent) block eligibility. Every linked guest/contributor identity must
opt in, in both directions; selecting the guest cannot bypass a linked contributor
restriction. Conflicting duplicate consent rows use the most restrictive state.
Phone normalization supports TZ 06/07 and +255/255 formats. Email never substitutes
for an SMS phone. Contacts deduplicate by normalized destination.

## Migration review (NOT applied in Phase 7E.4)

New: prisma/migrations/20261026120000_phase7e4_sms_queue/migration.sql.
Adds SmsJobState, nullable queue fields, default attempt count/state, and two indexes
on MessageRecipient. No DROP/DELETE/UPDATE or data backfill. Review locks and index
creation cost for the target database before application. Existing request-ID
migration 20261026100000_beem_sms_request_id predates this phase; it was already
applied to the local development database in the earlier conversation. Neither
migration was applied to any database during Phase 7E.4.

Dashboard reads old recipient columns explicitly and handles missing queue columns
with a migration-required status. Queue preparation likewise refuses cleanly until
migration review/application. Prisma generation does not migrate the database.

## Local verification and isolated PostgreSQL tests

npm run db:generate
npm run typecheck
npm test -- --maxWorkers=2
npm run build

The build script also executes scripts/prepare-standalone.cjs. No database test
runs without opt-in AND an exact loopback database named kadiyangu_phase7e1_test.
After reviewing the migrations, use a disposable local test database only:

```sh
export DATABASE_URL='postgresql://YOUR_LOCAL_USER@127.0.0.1:5432/kadiyangu_phase7e1_test'
# Only after migration review, against this disposable test DB:
npx prisma migrate deploy
ALLOW_PHASE7E4_DB_TESTS=true ALLOW_PHASE7E3_DB_TESTS=true npx vitest run tests/phase7e4-sms.integration.test.ts tests/phase7e3-messaging.integration.test.ts
```

No production, Railway or real Beem access is needed. Never use production DB URLs
for the integration suite. Mock fixtures are cleaned up after each integration test.

## Before live activation (separate explicit approval required)

1. Review/apply additive migration in an approved environment.
2. Receive actual Beem sender approval; provision server-only credentials and credits.
3. Confirm account rate limits, encoding, API rejection/retry guarantees and DLR host
   with Beem. Documentation's delivery guide names dlrapi.beem.africa; verify the
   account contract before wiring transport (the generic OpenAPI server differs).
4. Implement/review a real transport with explicit live approval gate, durable
   outbox leases, timeout reconciliation, delivery polling, and bounded throughput.
5. Keep mock history segregated; mock-complete records must never be promoted to
   live jobs. Review live idempotency semantics before adding live queue support.
6. Run isolated PostgreSQL concurrency tests, then an explicitly approved one-number
   pilot with consent, spend controls and delivery verification.

Phase status remains PREPARED regardless of credentials or Sender ID availability.

## Verification results

- Prisma Client generation: passed (Prisma 6.19.3).
- TypeScript: passed.
- Final production build: passed. Standalone packaging passed with all 22 migration
  directories, Prisma runtime/schema, public assets and static assets included.
- Messaging-focused tests: 39 passed, 8 PostgreSQL tests skipped.
- Full regression: 174 passed, 30 skipped, 2 failed. The unchanged
  tests/qr-zip.test.ts cases for 173 and 207 PNG passes exceeded their 30-second
  limits, including a repeat with maxWorkers=2. The full suite is not green.
- Changed TypeScript files: ESLint passed. git diff --check passed.
- PostgreSQL queue/claim concurrency tests: added but not executed; the additive
  queue migration remains unapplied pending review. Exact local commands above.
- No Railway access, deployment, production DB writes or real Beem API requests.

## Files in this change

- .env.example: empty provider placeholders and disabled-by-default flags.
- prisma/schema.prisma: queue metadata on existing recipients and log request ID.
- prisma/migrations/20261026120000_phase7e4_sms_queue/migration.sql: new pending
  additive migration.
- prisma/migrations/20261026100000_beem_sms_request_id/migration.sql: existing
  earlier-turn migration retained, not re-applied in this phase.
- src/services/beem-sms.ts: locked Beem adapter, mock adapter, configuration,
  pure request/response and DLR normalization.
- src/services/messaging-eligibility.ts: shared channel/linked-identity consent.
- src/services/sms-queue.ts: queue, bounded mock retries, audit, overview.
- src/services/messaging.ts: shared eligibility, safe transitions, legacy send lock.
- src/app/dashboard/events/[eventId]/messages/actions.ts: mock preparation action;
  legacy send action refuses.
- src/app/dashboard/events/[eventId]/messages/page.tsx: disabled/readiness/queue UI.
- tests/beem-sms.test.ts: provider preparation and safety contracts.
- tests/beem-campaign.test.ts: queue/worker authorization, idempotency and retries.
- tests/messaging-eligibility.test.ts: restrictive linked/channel consent.
- tests/phase7e4-sms.integration.test.ts: opt-in isolated PostgreSQL concurrency.
- docs/beem-sms.md: audit, architecture, verification and activation requirements.

Existing Phase 7E.3 test files were preserved unchanged.
