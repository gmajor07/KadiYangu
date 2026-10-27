-- REVIEW REQUIRED. Additive preparation only; do not apply without review.
-- No queue backfill: pre-existing recipient delivery states remain untouched.
CREATE TYPE "SmsJobState" AS ENUM ('NONE','PENDING','PROCESSING','RETRY_WAIT','COMPLETE','FAILED','UNCERTAIN');
ALTER TABLE "MessageRecipient"
  ADD COLUMN "smsJobState" "SmsJobState" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "smsMode" VARCHAR(8),
  ADD COLUMN "smsIdempotencyKey" VARCHAR(100),
  ADD COLUMN "smsAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "smsNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "smsLockedAt" TIMESTAMP(3),
  ADD COLUMN "smsErrorKind" VARCHAR(24),
  ADD COLUMN "smsFailureReason" VARCHAR(500),
  ADD COLUMN "smsProviderRequestId" VARCHAR(100),
  ADD COLUMN "smsDeliveryCheckedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "MessageRecipient_smsIdempotencyKey_key" ON "MessageRecipient"("smsIdempotencyKey");
CREATE INDEX "MessageRecipient_smsJobState_smsNextAttemptAt_idx" ON "MessageRecipient"("smsJobState","smsNextAttemptAt");
