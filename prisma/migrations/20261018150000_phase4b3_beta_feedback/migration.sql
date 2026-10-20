CREATE TABLE "BetaConfiguration" (
 "id" TEXT NOT NULL DEFAULT 'default', "enabled" BOOLEAN NOT NULL DEFAULT false,
 "personalExpiresAt" TIMESTAMP(3), "organizationExpiresAt" TIMESTAMP(3),
 "personalDesignLimit" INTEGER NOT NULL DEFAULT 3, "personalEventLimit" INTEGER NOT NULL DEFAULT 1,
 "personalGuestPassLimit" INTEGER NOT NULL DEFAULT 50, "organizationDesignLimit" INTEGER NOT NULL DEFAULT 25,
 "organizationEventLimit" INTEGER NOT NULL DEFAULT 10, "organizationGuestPassLimit" INTEGER NOT NULL DEFAULT 500,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BetaConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BetaGrant" (
 "id" TEXT NOT NULL, "userId" TEXT, "organizationId" TEXT, "grantType" VARCHAR(30) NOT NULL DEFAULT 'BETA_GRANT',
 "expiresAt" TIMESTAMP(3) NOT NULL, "designLimit" INTEGER NOT NULL DEFAULT 0, "eventLimit" INTEGER NOT NULL DEFAULT 0,
 "guestPassLimit" INTEGER NOT NULL DEFAULT 0, "designsUsed" INTEGER NOT NULL DEFAULT 0, "eventsUsed" INTEGER NOT NULL DEFAULT 0,
 "guestPassesUsed" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BetaGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BetaGrant_user_grant_key" ON "BetaGrant"("userId", "grantType");
CREATE UNIQUE INDEX "BetaGrant_org_grant_key" ON "BetaGrant"("organizationId", "grantType");
CREATE INDEX "BetaGrant_expires_idx" ON "BetaGrant"("expiresAt");
CREATE TABLE "Feedback" (
 "id" TEXT NOT NULL, "userId" TEXT, "organizationId" TEXT, "rating" INTEGER NOT NULL, "message" VARCHAR(2000) NOT NULL,
 "contactAllowed" BOOLEAN NOT NULL DEFAULT false, "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedAt" TIMESTAMP(3), CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Feedback_status_created_idx" ON "Feedback"("status", "createdAt");
CREATE INDEX "Feedback_user_created_idx" ON "Feedback"("userId", "createdAt");
ALTER TABLE "BetaGrant" ADD CONSTRAINT "BetaGrant_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BetaGrant" ADD CONSTRAINT "BetaGrant_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BetaGrant"
  ADD CONSTRAINT "BetaGrant_exactly_one_owner_chk"
  CHECK (num_nonnulls("userId", "organizationId") = 1);
ALTER TABLE "BetaGrant"
  ADD CONSTRAINT "BetaGrant_nonnegative_limits_chk"
  CHECK ("designLimit" >= 0 AND "eventLimit" >= 0 AND "guestPassLimit" >= 0 AND "designsUsed" >= 0 AND "eventsUsed" >= 0 AND "guestPassesUsed" >= 0);
ALTER TABLE "BetaGrant"
  ADD CONSTRAINT "BetaGrant_type_owner_chk"
  CHECK (("grantType" = 'BETA_GRANT' AND num_nonnulls("userId", "organizationId") = 1));
ALTER TABLE "BetaConfiguration"
  ADD CONSTRAINT "BetaConfiguration_nonnegative_limits_chk"
  CHECK ("personalDesignLimit" >= 0 AND "personalEventLimit" >= 0 AND "personalGuestPassLimit" >= 0 AND "organizationDesignLimit" >= 0 AND "organizationEventLimit" >= 0 AND "organizationGuestPassLimit" >= 0);
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_rating_chk" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_status_chk" CHECK ("status" IN ('OPEN', 'REVIEWED', 'RESOLVED'));
