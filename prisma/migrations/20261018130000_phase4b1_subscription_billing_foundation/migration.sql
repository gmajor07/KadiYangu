CREATE TYPE "SubscriptionPlanCode" AS ENUM ('STARTER', 'BUSINESS', 'ENTERPRISE');
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "OrganizationSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "OrganizationBillingStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'CANCELLED');

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL, "code" "SubscriptionPlanCode" NOT NULL, "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500), "monthlyAmount" INTEGER NOT NULL, "annualAmount" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS', "eventLimit" INTEGER, "designLimit" INTEGER,
  "memberLimit" INTEGER, "guestPassLimit" INTEGER, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE INDEX "SubscriptionPlan_active_code_idx" ON "SubscriptionPlan"("isActive", "code");

CREATE TABLE "OrganizationSubscription" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL,
  "status" "OrganizationSubscriptionStatus" NOT NULL DEFAULT 'PENDING', "interval" "BillingInterval" NOT NULL,
  "planNameSnapshot" VARCHAR(120) NOT NULL, "amountSnapshot" INTEGER NOT NULL,
  "currencySnapshot" VARCHAR(3) NOT NULL DEFAULT 'TZS', "periodStart" TIMESTAMP(3), "periodEnd" TIMESTAMP(3),
  "renewsAt" TIMESTAMP(3), "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationSubscription_org_status_idx" ON "OrganizationSubscription"("organizationId", "status", "periodEnd");
CREATE INDEX "OrganizationSubscription_plan_created_idx" ON "OrganizationSubscription"("planId", "createdAt");

CREATE TABLE "OrganizationBillingRecord" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planId" TEXT NOT NULL, "subscriptionId" TEXT,
  "initiatedByUserId" TEXT NOT NULL, "idempotencyKey" VARCHAR(120) NOT NULL,
  "status" "OrganizationBillingStatus" NOT NULL DEFAULT 'PENDING', "planNameSnapshot" VARCHAR(120) NOT NULL,
  "interval" "BillingInterval" NOT NULL, "amount" INTEGER NOT NULL, "currency" VARCHAR(3) NOT NULL DEFAULT 'TZS',
  "providerReference" TEXT, "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrganizationBillingRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationBillingRecord_idempotencyKey_key" ON "OrganizationBillingRecord"("idempotencyKey");
CREATE UNIQUE INDEX "OrganizationBillingRecord_providerReference_key" ON "OrganizationBillingRecord"("providerReference");
CREATE INDEX "OrganizationBillingRecord_org_status_idx" ON "OrganizationBillingRecord"("organizationId", "status", "createdAt");
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_plan_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationBillingRecord" ADD CONSTRAINT "OrganizationBillingRecord_plan_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationBillingRecord" ADD CONSTRAINT "OrganizationBillingRecord_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationBillingRecord" ADD CONSTRAINT "OrganizationBillingRecord_subscription_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationBillingRecord" ADD CONSTRAINT "OrganizationBillingRecord_initiator_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
