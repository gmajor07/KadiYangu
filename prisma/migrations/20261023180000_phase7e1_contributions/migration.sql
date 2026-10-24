CREATE TYPE "ContributionPledgeStatus" AS ENUM ('OPEN','PARTIALLY_PAID','PAID','CANCELLED');
CREATE TYPE "ContributionPaymentMethod" AS ENUM ('CASH','MPESA','MIXX_BY_YAS','AIRTEL_MONEY','BANK_TRANSFER','OTHER');
CREATE TYPE "ContributionVerificationStatus" AS ENUM ('PENDING','CONFIRMED','REJECTED','REVERSED');

CREATE TABLE "EventContributor" (
  "id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "guestId" TEXT,
  "fullName" VARCHAR(160) NOT NULL, "phone" VARCHAR(30), "email" VARCHAR(254), "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventContributor_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContributionPledge" (
  "id" TEXT NOT NULL, "contributorId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "dueDate" TIMESTAMP(3), "notes" VARCHAR(1000),
  "status" "ContributionPledgeStatus" NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionPledge_pkey" PRIMARY KEY ("id"), CONSTRAINT "ContributionPledge_amount_check" CHECK ("amount" > 0)
);
CREATE TABLE "ContributionPayment" (
  "id" TEXT NOT NULL, "contributorId" TEXT NOT NULL, "pledgeId" TEXT, "amount" INTEGER NOT NULL,
  "method" "ContributionPaymentMethod" NOT NULL, "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "referenceNumber" VARCHAR(120), "verificationStatus" "ContributionVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "recordedByUserId" TEXT NOT NULL, "notes" VARCHAR(1000), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionPayment_pkey" PRIMARY KEY ("id"), CONSTRAINT "ContributionPayment_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "EventContributor_eventId_guestId_key" ON "EventContributor"("eventId","guestId");
CREATE INDEX "EventContributor_eventId_fullName_idx" ON "EventContributor"("eventId","fullName");
CREATE INDEX "ContributionPledge_contributorId_status_idx" ON "ContributionPledge"("contributorId","status");
CREATE INDEX "ContributionPayment_contributorId_verificationStatus_idx" ON "ContributionPayment"("contributorId","verificationStatus");
CREATE INDEX "ContributionPayment_pledgeId_idx" ON "ContributionPayment"("pledgeId");
ALTER TABLE "EventContributor" ADD CONSTRAINT "EventContributor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventContributor" ADD CONSTRAINT "EventContributor_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContributionPledge" ADD CONSTRAINT "ContributionPledge_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "EventContributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionPayment" ADD CONSTRAINT "ContributionPayment_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "EventContributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionPayment" ADD CONSTRAINT "ContributionPayment_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "ContributionPledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContributionPayment" ADD CONSTRAINT "ContributionPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
