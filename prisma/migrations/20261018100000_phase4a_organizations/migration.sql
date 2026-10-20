CREATE TYPE "OrganizationType" AS ENUM ('AGENCY', 'RESELLER', 'PLANNER', 'BUSINESS');

CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'SCANNER', 'BILLING');

CREATE TYPE "OrganizationMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'AGENCY',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization" ("slug");

CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'EDITOR',
    "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMember_org_user_key"
    ON "OrganizationMember" ("organizationId", "userId");

CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'EDITOR',
    "tokenHash" VARCHAR(64) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
    ON "OrganizationInvitation" ("tokenHash");

ALTER TABLE "Design" ADD COLUMN "organizationId" TEXT;

ALTER TABLE "Event" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "Design_organizationId_idx" ON "Design" ("organizationId");

CREATE INDEX "Event_organizationId_status_idx" ON "Event" ("organizationId", "status");

ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_owner_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_org_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_user_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
    ADD CONSTRAINT "OrganizationInvitation_org_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
    ADD CONSTRAINT "OrganizationInvitation_inviter_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Design"
    ADD CONSTRAINT "Design_org_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Event"
    ADD CONSTRAINT "Event_org_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
